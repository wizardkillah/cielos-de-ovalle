/* =====================================================================
   cosmos.js — «Escalas del cosmos»: del Sistema Solar al Grupo Local
   Un solo espacio 3D continuo (unidades: UA, eclíptica J2000, Sol en el
   origen) con zoom logarítmico. Proyección ortográfica inclinada.

   Real:      planetas (posición del momento), Plutón, estrellas vecinas,
              dirección y distancia del centro galáctico y de las galaxias.
   Esquema:   cinturones, nube de Oort y brazos espirales (ilustrativos).
   ===================================================================== */
var Cosmos = (function () {
  'use strict';
  var A = Astro, RAD = A.RAD, LY = A.LY_AU;

  var STOPS = [
    { id: 'inner', span: 4.4 },
    { id: 'outer', span: 72 },
    { id: 'helio', span: 460 },
    { id: 'oort', span: 2.6e5 },
    { id: 'near', span: 30 * LY },
    { id: 'bright', span: 2400 * LY },
    { id: 'galaxy', span: 1.35e5 * LY },
    { id: 'local', span: 7.2e6 * LY }
  ];
  var view = { yaw: 0.6, pitch: 0.62, span: 4.4, goal: 4.4 };
  var W = 0, H = 0, CX = 0, CY = 0, K = 1, cy = 1, sy = 0, cp = 1, sp = 0;
  var PX = 0, PY = 0, picks = [], placed = [];
  // Marco de la vista: plano de la eclíptica a escala planetaria y plano galáctico a
  // escala de la galaxia. Fm rota gradualmente de uno a otro; TG desplaza el centro.
  var Fm = [1, 0, 0, 0, 1, 0, 0, 0, 1], TG = [0, 0, 0], VX = 0, VY = 0, VZ = 0;
  var AX = (function () {
    var E = [1, 0, 0, 0, Math.cos(A.EPS0), -Math.sin(A.EPS0), 0, Math.sin(A.EPS0), Math.cos(A.EPS0)];
    var Rg = A.mul(A.transpose(A.GAL), E), th = Math.acos(A.clamp((Rg[0] + Rg[4] + Rg[8] - 1) / 2, -1, 1)), s = 2 * Math.sin(th);
    return { th: th, a: [(Rg[7] - Rg[5]) / s, (Rg[2] - Rg[6]) / s, (Rg[3] - Rg[1]) / s] };
  })();
  function setFrame(b) {
    var t = AX.th * b, c = Math.cos(t), s = Math.sin(t), k = 1 - c, x = AX.a[0], y = AX.a[1], z = AX.a[2];
    Fm = [c + k * x * x, k * x * y - s * z, k * x * z + s * y,
          k * y * x + s * z, c + k * y * y, k * y * z - s * x,
          k * z * x - s * y, k * z * y + s * x, c + k * z * z];
  }

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function eclFromRaDec(ra, dec, dist) {
    var v = A.equ0ToEcl(A.vecFromRaDec(ra, dec)); return [v[0] * dist, v[1] * dist, v[2] * dist];
  }
  function eclFromGal(g) { return A.equ0ToEcl(A.apply(A.GAL, g)); }

  /* ---------- Escena estática ---------- */
  var PLUTO = [39.48211675, -0.00031596, 0.24882730, 0.00005170, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482];
  var ORB = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  var orbits = {}, belt, kuiper, oort, galaxy, near, far, gc;

  function plutoPos(T) {
    var k = PLUTO, a = k[0] + k[1] * T, e = k[2] + k[3] * T, I = (k[4] + k[5] * T) * RAD,
        L = k[6] + k[7] * T, wb = k[8] + k[9] * T, O = (k[10] + k[11] * T) * RAD,
        w = wb * RAD - O, M = A.norm180(L - wb) * RAD, E = M, i;
    for (i = 0; i < 12; i++) E = M + e * Math.sin(E);
    var xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
    return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
            (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, sw * sI * xp + cw * sI * yp];
  }

  function build(T) {
    var r = rng(11), i, n, a, p;
    ORB.forEach(function (id) {
      // Período en siglos (tercera ley de Kepler) para recorrer una órbita completa
      var semi = { mercury: 0.387, venus: 0.723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 }[id];
      var per = Math.pow(semi, 1.5) / 100, o = new Float32Array(97 * 3);
      for (i = 0; i <= 96; i++) { p = A.helio(id, T + per * i / 96); o[i * 3] = p[0]; o[i * 3 + 1] = p[1]; o[i * 3 + 2] = p[2]; }
      orbits[id] = o;
    });
    var po = new Float32Array(97 * 3);
    for (i = 0; i <= 96; i++) { p = plutoPos(T + 2.48 * i / 96); po[i * 3] = p[0]; po[i * 3 + 1] = p[1]; po[i * 3 + 2] = p[2]; }
    orbits.pluto = po;

    function ring(count, r0, r1, thick) {
      var o = new Float32Array(count * 3);
      for (var j = 0; j < count; j++) {
        var rad = r0 + (r1 - r0) * Math.sqrt(r()), an = r() * 6.2832;
        o[j * 3] = Math.cos(an) * rad; o[j * 3 + 1] = Math.sin(an) * rad; o[j * 3 + 2] = (r() + r() - 1) * thick * rad;
      }
      return o;
    }
    belt = ring(520, 2.1, 3.3, 0.07);
    kuiper = ring(520, 30, 50, 0.12);
    n = 900; oort = new Float32Array(n * 3);
    for (i = 0; i < n; i++) {
      var rad = 2000 * Math.pow(50, r()), z = r() * 2 - 1, an2 = r() * 6.2832, s = Math.sqrt(1 - z * z);
      oort[i * 3] = rad * s * Math.cos(an2); oort[i * 3 + 1] = rad * s * Math.sin(an2); oort[i * 3 + 2] = rad * z;
    }
    // Vía Láctea esquemática en coordenadas galácticas (Sol en el origen, centro en +X)
    var R0 = 26700; n = 5200; galaxy = { p: new Float32Array(n * 3), c: new Uint8Array(n) };
    var g2 = rng(77);
    function gs() { return (g2() + g2() + g2() - 1.5) * 1.15; }
    for (i = 0; i < n; i++) {
      var x, y, zz, col = 0, t = g2();
      if (t < 0.16) {            // bulbo y barra
        x = gs() * 9000; y = gs() * 3600; zz = gs() * 2400;
        var rot = 0.45, xr = x * Math.cos(rot) - y * Math.sin(rot); y = x * Math.sin(rot) + y * Math.cos(rot); x = xr; col = 1;
      } else if (t < 0.8) {      // cuatro brazos (espiral logarítmica, paso ~12°)
        var arm = Math.floor(g2() * 4), th = g2() * 4.6, rr = 11000 * Math.exp(0.213 * th);
        if (rr > 56000) { rr = 56000 * g2(); }
        var ang = th + arm * 1.5708 + 0.9, sprd = 1500 + rr * 0.05;
        x = Math.cos(ang) * rr + gs() * sprd; y = Math.sin(ang) * rr + gs() * sprd; zz = gs() * 600;
      } else {                   // disco difuso
        var rd = -17000 * Math.log(1 - g2() * 0.95), ad = g2() * 6.2832;
        x = Math.cos(ad) * rd; y = Math.sin(ad) * rd; zz = gs() * 900; col = 2;
      }
      var e = eclFromGal([(R0 - x) * LY, -y * LY, zz * LY]);
      galaxy.p[i * 3] = e[0]; galaxy.p[i * 3 + 1] = e[1]; galaxy.p[i * 3 + 2] = e[2]; galaxy.c[i] = col;
    }
    gc = eclFromGal([R0 * LY, 0, 0]);
    near = CONTENT.near.map(function (s) { return { es: s[0], en: s[1], d: s[4], col: s[5], p: eclFromRaDec(s[2], s[3], s[4] * LY) }; });
    far = CONTENT.far.map(function (s) { return { es: s[0], en: s[1], d: s[4], size: s[5], p: eclFromRaDec(s[2], s[3], s[4] * LY) }; });
  }

  /* ---------- Proyección ---------- */
  // projV: coordenadas ya en el marco de la vista.  proj: coordenadas eclípticas.
  function projV(x, y, z) {
    var xr = x * cy - y * sy, yr = x * sy + y * cy;
    PX = CX + xr * K; PY = CY - (yr * sp + z * cp) * K;
    return PX > -40 && PX < W + 40 && PY > -40 && PY < H + 40;
  }
  function proj(x, y, z) {
    x -= TG[0]; y -= TG[1]; z -= TG[2];
    VX = Fm[0] * x + Fm[1] * y + Fm[2] * z; VY = Fm[3] * x + Fm[4] * y + Fm[5] * z; VZ = Fm[6] * x + Fm[7] * y + Fm[8] * z;
    return projV(VX, VY, VZ);
  }
  function fade(span, lo0, lo1, hi0, hi1) {     // visible entre lo y hi (escala logarítmica)
    var l = Math.log(span) / Math.LN10, a = 1;
    if (lo0 !== null) a = Math.min(a, A.clamp((l - Math.log(lo0) / Math.LN10) / (Math.log(lo1 / lo0) / Math.LN10), 0, 1));
    if (hi0 !== null) a = Math.min(a, 1 - A.clamp((l - Math.log(hi0) / Math.LN10) / (Math.log(hi1 / hi0) / Math.LN10), 0, 1));
    return a;
  }
  function points(ctx, arr, size, color, alpha) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (var i = 0; i < arr.length; i += 3) if (proj(arr[i], arr[i + 1], arr[i + 2])) ctx.fillRect(PX, PY, size, size);
    ctx.globalAlpha = 1;
  }
  function path(ctx, arr) {
    ctx.beginPath();
    for (var i = 0; i < arr.length; i += 3) { proj(arr[i], arr[i + 1], arr[i + 2]); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
    ctx.stroke();
  }
  function text(ctx, s, x, y, color, font, alpha, avoid) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.font = font || ('500 11px ' + Sky.FONT_UI);
    if (avoid) {
      // Prueba a la derecha, debajo, encima y a la izquierda del punto antes de rendirse
      var w = ctx.measureText(s).width, tries = [[x, y], [x - 4, y + 15], [x - 4, y - 13], [x - w - 16, y]], ok = false;
      for (var t = 0; t < tries.length && !ok; t++) {
        var tx = tries[t][0], ty = tries[t][1]; ok = tx > 2 && tx + w < W - 2;
        for (var i = 0; i < placed.length && ok; i++) { var b = placed[i]; if (tx < b[2] && tx + w > b[0] && ty - 11 < b[3] && ty + 3 > b[1]) ok = false; }
        if (ok) { x = tx; y = ty; }
      }
      if (!ok) { ctx.globalAlpha = 1; return false; }
      placed.push([x - 4, y - 13, x + w + 4, y + 5]);
    }
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  }
  function fmtDist(au, lang) {
    var es = lang === 'es', ly = au / LY;
    function n(v) { return v >= 100 ? Math.round(v).toLocaleString(es ? 'es-CL' : 'en-US') : v >= 10 ? v.toFixed(0) : v.toFixed(1).replace('.', es ? ',' : '.'); }
    if (au < 2000) return n(au) + (es ? ' UA' : ' AU');
    if (ly < 0.1) return n(au) + (es ? ' UA' : ' AU');
    if (ly < 1e6) return n(ly) + (es ? ' años luz' : ' light-years');
    return n(ly / 1e6) + (es ? ' millones de años luz' : ' million light-years');
  }

  function drawGrid(ctx, lang) {
    var span = view.span, useLy = span > 0.6 * LY, unit = useLy ? LY : 1;
    var e0 = Math.floor(Math.log(span / unit) / Math.LN10) - 2, j, i;
    ctx.lineWidth = 1;
    for (j = e0; j <= e0 + 3; j++) {
      var rad = Math.pow(10, j) * unit, frac = rad / span;
      var a = A.clamp(1 - Math.abs(Math.log(frac / 0.22) / Math.LN10) / 1.15, 0, 1);
      if (a < 0.03) continue;
      ctx.strokeStyle = 'rgba(46,224,176,' + (0.34 * a) + ')';
      ctx.beginPath();
      for (i = 0; i <= 96; i++) { var t = i / 96 * 6.2832; projV(Math.cos(t) * rad, Math.sin(t) * rad, 0); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
      ctx.stroke();
      projV(rad * Math.cos(-view.yaw + 0.5), rad * Math.sin(-view.yaw + 0.5), 0);
      text(ctx, fmtDist(rad, lang), PX + 4, PY - 4, '#49e6b8', '600 10px ' + Sky.FONT_DISPLAY, a * 0.9);
    }
    ctx.strokeStyle = 'rgba(46,224,176,0.09)';
    ctx.beginPath();
    for (i = 0; i < 12; i++) { var t2 = i * 0.5236; projV(0, 0, 0); ctx.moveTo(PX, PY); projV(Math.cos(t2) * span, Math.sin(t2) * span, 0); ctx.lineTo(PX, PY); }
    ctx.stroke();
    // Cúpula holográfica
    var R = span * 0.47;
    ctx.strokeStyle = 'rgba(46,224,176,0.07)';
    for (j = 1; j < 6; j++) {
      var el = j * 15 * RAD, rr = R * Math.cos(el), zz = R * Math.sin(el);
      ctx.beginPath();
      for (i = 0; i <= 72; i++) { var t3 = i / 72 * 6.2832; projV(Math.cos(t3) * rr, Math.sin(t3) * rr, zz); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
      ctx.stroke();
    }
    for (j = 0; j < 12; j++) {
      ctx.beginPath();
      for (i = 0; i <= 18; i++) { var e2 = i * 5 * RAD; projV(Math.cos(j * 0.5236) * R * Math.cos(e2), Math.sin(j * 0.5236) * R * Math.cos(e2), R * Math.sin(e2)); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
      ctx.stroke();
    }
  }

  // Estelas radiales mientras cambia la escala: sensación de viaje
  function drawWarp(ctx, v, ls) {
    var a = Math.min(0.5, (Math.abs(v) - 0.12) * 0.22), R = Math.max(W, H) * 0.75, i;
    ctx.strokeStyle = '#aad7ff'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (i = 0; i < 72; i++) {
      var ang = i * 2.39996, ph = (((-ls * 0.9 + i * 0.137) % 1) + 1) % 1, c = Math.cos(ang), s = Math.sin(ang);
      var r0 = (0.1 + ph * 0.9) * R, len = (10 + 80 * Math.min(1, Math.abs(v) / 4)) * (0.3 + ph);
      ctx.globalAlpha = a * ph;
      ctx.beginPath(); ctx.moveTo(CX + c * r0, CY + s * r0); ctx.lineTo(CX + c * (r0 + len), CY + s * (r0 + len)); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }

  function dot(ctx, x, y, r, color, glow) {
    if (glow) { ctx.globalAlpha = 0.5; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.2832); ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  function render(ctx, w, h, S, dt) {
    W = w; H = h; CX = W / 2; CY = H / 2 + 6;
    if (!belt) build(A.centuriesTT(A.jdFromMs(S.t)));
    // Zoom animado en escala logarítmica
    var ls = Math.log(view.span), lg = Math.log(view.goal);
    view.span = Math.exp(ls + (lg - ls) * Math.min(1, dt * 4.5));
    var span = view.span, lang = S.lang, es = lang === 'es';
    K = Math.min(W, H) / span;
    cy = Math.cos(view.yaw); sy = Math.sin(view.yaw); cp = Math.cos(view.pitch); sp = Math.sin(view.pitch);
    picks.length = 0; placed.length = 0;
    setFrame(fade(span, 400 * LY, 4000 * LY, null, null));
    var tg = fade(span, 6000 * LY, 60000 * LY, null, null);
    TG = [gc[0] * tg, gc[1] * tg, gc[2] * tg];
    proj(0, 0, 0); placed.push([PX + 4, PY - 22, PX + 96, PY - 2]);      // reserva la etiqueta del Sol

    var g = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#061019'); g.addColorStop(1, '#010306');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawGrid(ctx, lang);
    if (Math.abs(lg - ls) > 0.12 && !Sky.fx.reduce) drawWarp(ctx, lg - ls, ls);

    var T = A.centuriesTT(A.jdFromMs(S.t)), i, a, p;

    /* Galaxia y Grupo Local */
    a = fade(span, 900 * LY, 9000 * LY, null, null);
    if (a > 0.01) {
      ctx.globalAlpha = a * 0.75;
      var cols = ['#b9cfff', '#ffe2b0', '#8fa6cf'], gp = galaxy.p, gcn = galaxy.c, sz = span > 1e6 * LY ? 1 : 1.5;
      for (var c = 0; c < 3; c++) {
        ctx.fillStyle = cols[c];
        for (i = 0; i < gcn.length; i++) if (gcn[i] === c && proj(gp[i * 3], gp[i * 3 + 1], gp[i * 3 + 2])) ctx.fillRect(PX, PY, sz, sz);
      }
      ctx.globalAlpha = 1;
      if (proj(gc[0], gc[1], gc[2])) {
        dot(ctx, PX, PY, 3, '#ffc861', true);
        text(ctx, es ? 'Centro galáctico · Sgr A*' : 'Galactic center · Sgr A*', PX + 8, PY + 4, '#ffc861', '600 11px ' + Sky.FONT_UI, a, true);
        picks.push({ x: PX, y: PY, o: { name: es ? 'Centro de la Vía Láctea' : 'Center of the Milky Way', dist: 26700 * LY, kind: 'gc' } });
      }
      text(ctx, es ? 'Brazos espirales: esquema ilustrativo' : 'Spiral arms: illustrative sketch', 14, H - 150, 'rgba(160,190,220,0.6)', 'italic 11px ' + Sky.FONT_UI, a * fade(span, null, null, 3e5 * LY, 1e6 * LY));
    }
    a = fade(span, 3e4 * LY, 2e5 * LY, null, null);
    if (a > 0.01) far.forEach(function (f) {
      if (!proj(f.p[0], f.p[1], f.p[2])) return;
      var r = Math.max(3, f.size * LY * K / 2);
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#9db6ff'; ctx.beginPath(); ctx.ellipse(PX, PY, r, r * 0.6, 0.5, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      text(ctx, f[lang], PX + r + 5, PY + 4, '#b9cfff', null, a, true);
      picks.push({ x: PX, y: PY, o: { name: f[lang], dist: f.d * LY, kind: 'galaxy' } });
    });

    /* Estrellas vecinas */
    a = fade(span, 1.2 * LY, 6 * LY, 4e4 * LY, 2e5 * LY);
    if (a > 0.01) near.forEach(function (s) {
      var da = a * fade(span, s.d * LY * 0.9, s.d * LY * 2.4, s.d * LY * 12, s.d * LY * 60);
      if (da < 0.02) return;
      var vis = proj(s.p[0], s.p[1], s.p[2]), x = PX, y = PY;
      projV(VX, VY, 0);
      ctx.strokeStyle = 'rgba(120,170,255,' + (0.3 * da) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(PX, PY); ctx.stroke();
      ctx.fillStyle = 'rgba(120,170,255,' + (0.4 * da) + ')'; ctx.fillRect(PX - 1.5, PY - 1.5, 3, 3);
      if (!vis) return;
      ctx.globalAlpha = da; dot(ctx, x, y, 2.6, s.col, true);
      text(ctx, s[lang], x + 7, y + 4, 'rgba(226,236,255,0.9)', null, da, true);
      picks.push({ x: x, y: y, o: { name: s[lang], dist: s.d * LY, kind: 'star' } });
    });

    /* Nube de Oort, heliopausa, Voyager */
    points(ctx, oort, 1.3, '#8fb4d8', 0.55 * fade(span, 900, 8000, 3 * LY, 30 * LY));
    a = fade(span, 900, 9000, 2.5 * LY, 20 * LY);
    if (a > 0.05) { proj(0, 0, 0); text(ctx, es ? 'Nube de Oort (esquema)' : 'Oort cloud (sketch)', PX + 12, PY - 30000 * K * 0.4, '#8fb4d8', null, a); }
    a = fade(span, 120, 260, 4000, 30000);
    if (a > 0.01) {
      ctx.strokeStyle = 'rgba(255,200,97,' + (0.5 * a) + ')'; ctx.setLineDash([4, 5]); ctx.beginPath();
      for (i = 0; i <= 72; i++) { var th = i / 72 * 6.2832; proj(Math.cos(th) * 120, Math.sin(th) * 120, 0); if (i) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY); }
      ctx.stroke(); ctx.setLineDash([]);
      proj(0, -120, 0); text(ctx, es ? 'Heliopausa ≈ 120 UA' : 'Heliopause ≈ 120 AU', PX + 6, PY + 14, '#ffc861', null, a);
      var yr = 2000 + T * 100;
      [['Voyager 1', 258.3, 12.0, 162.7 + 3.57 * (yr - 2024)], ['Voyager 2', 301.0, -58.5, 136.3 + 3.24 * (yr - 2024)]].forEach(function (v) {
        var q = eclFromRaDec(v[1], v[2], v[3]);
        if (!proj(q[0], q[1], q[2])) return;
        ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(PX - 2, PY - 2, 4, 4);
        text(ctx, v[0] + ' · ' + Math.round(v[3]) + (es ? ' UA' : ' AU'), PX + 7, PY + 4, '#ffffff', null, a, true);
        picks.push({ x: PX, y: PY, o: { name: v[0], dist: v[3], kind: 'probe' } });
      });
    }

    /* Sistema Solar */
    a = fade(span, null, null, 900, 9000);
    if (a > 0.01) {
      points(ctx, kuiper, 1.2, '#7f93ad', 0.6 * a * fade(span, 20, 60, null, null));
      points(ctx, belt, 1.1, '#9a8f82', 0.7 * a * fade(span, null, null, 40, 160));
      ctx.lineWidth = 1;
      ORB.concat(['pluto']).forEach(function (id) {
        var semi = { mercury: 0.39, venus: 0.72, earth: 1, mars: 1.52, jupiter: 5.2, saturn: 9.5, uranus: 19.2, neptune: 30, pluto: 39.5 }[id];
        var oa = a * fade(span, semi * 0.45, semi * 1.2, null, null);
        if (oa < 0.02) return;
        var colr = id === 'earth' ? '#6fb1ff' : id === 'pluto' ? '#b7a79a' : CONTENT.bodies[id].color;
        ctx.strokeStyle = colr; ctx.globalAlpha = 0.4 * oa; path(ctx, orbits[id]); ctx.globalAlpha = 1;
        p = id === 'pluto' ? plutoPos(T) : A.helio(id, T);
        if (!proj(p[0], p[1], p[2]) || semi * K < 5) return;
        var rad = id === 'jupiter' || id === 'saturn' ? 5 : id === 'pluto' || id === 'mercury' ? 2.6 : 3.6;
        ctx.globalAlpha = oa; dot(ctx, PX, PY, rad, colr, true);
        if (id === 'saturn') { ctx.strokeStyle = colr; ctx.beginPath(); ctx.ellipse(PX, PY, 9, 3, -0.3, 0, 6.2832); ctx.stroke(); }
        var nm = id === 'earth' ? (es ? 'Tierra' : 'Earth') : id === 'pluto' ? (es ? 'Plutón' : 'Pluto') : CONTENT.bodies[id].name[lang];
        if (semi * K > 22) text(ctx, nm, PX + rad + 5, PY + 4, colr, '600 11px ' + Sky.FONT_DISPLAY, oa, true);
        picks.push({ x: PX, y: PY, o: { name: nm, dist: Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]), kind: 'planet', id: id } });
      });
    }
    /* Sol */
    proj(0, 0, 0);
    dot(ctx, PX, PY, span < 2000 ? 6 : 3.5, '#ffd76a', true);
    var sl = span < 6e5 ? (es ? 'Sol' : 'Sun') : (es ? 'Tú estás aquí' : 'You are here');
    text(ctx, sl, PX + 9, PY - 8, '#ffd76a', '700 12px ' + Sky.FONT_DISPLAY);
  }

  function pick(x, y) {
    var best = null, bd = 30;
    picks.forEach(function (p) { var d = Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)); if (d < bd) { bd = d; best = p.o; } });
    return best;
  }
  function stopFor(span) {
    var best = 0, bd = 1e9;
    STOPS.forEach(function (s, i) { var d = Math.abs(Math.log(span / s.span)); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  return { view: view, STOPS: STOPS, render: render, pick: pick, stopFor: stopFor, fmtDist: fmtDist };
})();
