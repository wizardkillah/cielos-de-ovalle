/* =====================================================================
   sky.js — Renderizador del cielo (Canvas 2D)
   Cámara = base ortonormal {R, U, F} en coordenadas [Este, Norte, Arriba].
   · Modo manual / brújula: proyección estereográfica (los círculos de la
     esfera siguen siendo círculos: el horizonte se rellena de forma exacta).
   · Modo cámara (RA): proyección gnomónica, la misma de una lente.
   ===================================================================== */
var Sky = (function () {
  'use strict';
  var A = Astro, RAD = A.RAD, DEG = A.DEG;
  var ST = CATALOG.stars, N = ST.length / 4;

  /* ---------- Datos precalculados ---------- */
  var sv = new Float32Array(N * 3), smag = new Float32Array(N), scol = new Uint8Array(N);
  var senu = new Float32Array(N * 3);
  var COLORS = ['#a9c3ff', '#cbd9ff', '#f0f3ff', '#fff5e2', '#ffe4b3', '#ffcc90', '#ffab78'];
  var BV = [-0.1, 0.15, 0.4, 0.7, 1.0, 1.4];
  (function () {
    for (var i = 0; i < N; i++) {
      var v = A.vecFromRaDec(ST[i * 4] / 1000, ST[i * 4 + 1] / 1000);
      sv[i * 3] = v[0]; sv[i * 3 + 1] = v[1]; sv[i * 3 + 2] = v[2];
      smag[i] = ST[i * 4 + 2] / 100;
      var bv = ST[i * 4 + 3] / 100, c = 0;
      while (c < BV.length && bv >= BV[c]) c++;
      scol[i] = c;
    }
  })();

  // Líneas y nombres de constelaciones → vectores J2000
  var conLines = [], conLineId = [], conLabels = [];
  Object.keys(CATALOG.lines).forEach(function (id) {
    CATALOG.lines[id].forEach(function (seg) {
      var a = new Float32Array(seg.length * 3);
      seg.forEach(function (p, i) { var v = A.vecFromRaDec(p[0], p[1]); a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; });
      conLines.push(a); conLineId.push(id);
    });
  });
  Object.keys(CATALOG.cons).forEach(function (id) {
    var c = CATALOG.cons[id];
    conLabels.push({ id: id, en: c[0], es: c[1], v: A.vecFromRaDec(c[2], c[3]), rank: c[4] });
  });
  var dsos = CONTENT.dsos.map(function (d) { return { d: d, v: A.vecFromRaDec(d.ra, d.dec) }; });

  // Vía Láctea: nube de manchas suaves sobre el plano galáctico (determinista)
  var mw = (function () {
    var seed = 20261116, out = [];
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    function gauss() { return (rnd() + rnd() + rnd() + rnd() - 2) * 1.2; }
    for (var i = 0; i < 620; i++) {
      var l = rnd() * 360, dl = A.norm180(l);
      var core = Math.exp(-(dl * dl) / (2 * 38 * 38));
      if (rnd() > 0.32 + 0.68 * core) { continue; }
      var sig = 3.2 + 6.5 * core, b = gauss() * sig;
      // Franja oscura (Gran Grieta) entre el centro y Cygnus
      var rift = (dl > -5 && dl < 75 && Math.abs(b - 1.5) < 1.6) ? 0.35 : 1;
      var g = A.vecFromRaDec(l, b);
      var e = A.apply(A.GAL, g);
      out.push({ v: e, size: 5 + 7 * rnd() + 5 * core, a: (0.042 + 0.095 * core) * rift * (0.6 + 0.4 * rnd()) });
    }
    return out;
  })();

  /* ---------- Sprites ---------- */
  function glowSprite(rgb, hard) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + (hard ? 1 : 0.9) + ')');
    gr.addColorStop(hard ? 0.25 : 0.12, 'rgba(' + rgb + ',0.42)');
    gr.addColorStop(0.5, 'rgba(' + rgb + ',0.1)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  var SPR = null;
  function sprites() {
    if (SPR) return SPR;
    SPR = {
      star: glowSprite('220,232,255'), warm: glowSprite('255,214,160'), mw: glowSprite('150,178,230'),
      neb: glowSprite('255,120,170'), gal: glowSprite('170,190,255'), clu: glowSprite('255,236,190'),
      sun: glowSprite('255,214,110', true), moon: glowSprite('220,230,255')
    };
    return SPR;
  }

  /* ---------- Estado de cuadro ---------- */
  var W = 0, H = 0, CX = 0, CY = 0, K = 1, gnomonic = false, cullZ = -0.7;
  var R = [1, 0, 0], U = [0, 0, 1], F = [0, 1, 0];
  var PX = 0, PY = 0, PZ = 0;
  var M = null, Md = null, bodies = {}, jdNow = 0;
  var picks = [], labels = [];
  // Efectos: entrada, centelleo, estrellas fugaces, realce de la selección.
  // Son ambientales y se apagan con «movimiento reducido» o con la capa fx.
  var fx = { intro0: -1e9, selT: 0, selKey: '', hiCon: null, meteors: [], nextMeteor: 0, reduce: false, on: true };
  var lineA = 1, tNow = 0;

  function setCamera(S) {
    R = S.cam.R; U = S.cam.U; F = S.cam.F;
    gnomonic = !!(S.sensor && S.camera);
    if (gnomonic) { K = (Math.max(W, H) / 2) / Math.tan(S.camFov / 2 * RAD); cullZ = 0.08; }
    else { K = (Math.min(W, H) / 2) / Math.tan(S.view.fov / 4 * RAD); cullZ = -0.72; }
  }
  // Proyecta un vector ENU. Devuelve false si queda detrás.
  function proj(e, n, u) {
    var x = e * R[0] + n * R[1] + u * R[2], y = e * U[0] + n * U[1] + u * U[2], z = e * F[0] + n * F[1] + u * F[2];
    PZ = z;
    if (z < cullZ) return false;
    var k = gnomonic ? K / z : K / (1 + z);
    PX = CX + x * k; PY = CY - y * k;
    return true;
  }
  function projV(v) { return proj(v[0], v[1], v[2]); }
  function onScreen(m) { m = m || 0; return PX > -m && PX < W + m && PY > -m && PY < H + m; }
  // Inversa de proj: dirección ENU bajo un punto de la pantalla
  function unproject(px, py) {
    var a = (px - CX) / K, b = -(py - CY) / K, x, y, z;
    if (gnomonic) { var l = Math.sqrt(a * a + b * b + 1); x = a / l; y = b / l; z = 1 / l; }
    else { var q = a * a + b * b; z = (1 - q) / (1 + q); x = a * (1 + z); y = b * (1 + z); }
    return [x * R[0] + y * U[0] + z * F[0], x * R[1] + y * U[1] + z * F[1], x * R[2] + y * U[2] + z * F[2]];
  }
  // Grados por píxel en el centro de la vista
  function degPerPx() { return gnomonic ? DEG / K : 2 * DEG / K; }

  /* ---------- Utilidades de dibujo ---------- */
  function polyline(ctx, n, fn) {
    var pen = false, lx = 0, ly = 0, jump = Math.max(W, H) * 0.7;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var v = fn(i);
      if (!proj(v[0], v[1], v[2])) { pen = false; continue; }
      if (pen && Math.abs(PX - lx) + Math.abs(PY - ly) < jump) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY);
      pen = true; lx = PX; ly = PY;
    }
    ctx.stroke();
  }
  function label(ctx, text, x, y, font, color, force, align) {
    ctx.font = font;
    var w = ctx.measureText(text).width, h = 13;
    var x0 = align === 'center' ? x - w / 2 : x, y0 = y - h + 2;
    if (x0 < 2 || x0 + w > W - 2 || y0 < 2 || y0 + h > H - 2) { if (!force) return false; }
    if (!force) {
      for (var i = 0; i < labels.length; i++) {
        var b = labels[i];
        if (x0 < b[2] && x0 + w > b[0] && y0 < b[3] && y0 + h > b[1]) return false;
      }
    }
    labels.push([x0 - 3, y0 - 2, x0 + w + 3, y0 + h + 2]);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x0, y);
    return true;
  }

  /* ---------- Suelo: el horizonte es un círculo exacto en estereográfica ---------- */
  function stereo(v) {
    var x = v[0] * R[0] + v[1] * R[1] + v[2] * R[2], y = v[0] * U[0] + v[1] * U[1] + v[2] * U[2],
        z = v[0] * F[0] + v[1] * F[1] + v[2] * F[2], k = K / (1 + Math.max(z, -0.999));
    return [CX + x * k, CY - y * k];
  }
  function groundPath(ctx, az) {
    var p1 = stereo(A.enuFromAzAlt(az, 0)), p2 = stereo(A.enuFromAzAlt(az + 105, 0)), p3 = stereo(A.enuFromAzAlt(az - 105, 0));
    var ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1];
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    var nadirIn, big = Math.max(W, H) * 40;
    var nz = -F[2];                       // componente z del nadir en cámara
    var nd = nz > -0.9 ? stereo([0, 0, -1]) : null, zn = stereo([0, 0, 1]);
    ctx.beginPath();
    if (Math.abs(d) < 1e-3 || Math.abs((ax * ax + ay * ay) / d) > 1e7) {
      halfPlane(ctx, p3, p2, nd || zn, !!nd, big); return;
    }
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    var r = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
    if (r > big) { halfPlane(ctx, p3, p2, nd || zn, !!nd, big); return; }
    if (nd) nadirIn = (nd[0] - ux) * (nd[0] - ux) + (nd[1] - uy) * (nd[1] - uy) < r * r;
    else nadirIn = !((zn[0] - ux) * (zn[0] - ux) + (zn[1] - uy) * (zn[1] - uy) < r * r);
    if (nadirIn) { ctx.arc(ux, uy, r, 0, 6.2832); }
    else { ctx.rect(-10, -10, W + 20, H + 20); ctx.arc(ux, uy, r, 0, 6.2832, true); }
  }
  function halfPlane(ctx, a, b, ref, refIsGround, big) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    var nx = -dy, ny = dx, side = (ref[0] - a[0]) * nx + (ref[1] - a[1]) * ny;
    if ((side < 0) === refIsGround) { nx = -nx; ny = -ny; }
    ctx.moveTo(a[0] - dx * big, a[1] - dy * big); ctx.lineTo(a[0] + dx * big, a[1] + dy * big);
    ctx.lineTo(a[0] + dx * big + nx * big, a[1] + dy * big + ny * big);
    ctx.lineTo(a[0] - dx * big + nx * big, a[1] - dy * big + ny * big); ctx.closePath();
  }

  /* ---------- Capas ---------- */
  function drawBackground(ctx, S, sunAlt) {
    if (gnomonic) { ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(0,6,10,0.28)'; ctx.fillRect(0, 0, W, H); return; }
    var g = ctx.createRadialGradient(CX, CY * 0.9, 0, CX, CY, Math.max(W, H) * 0.85);
    g.addColorStop(0, '#07131c'); g.addColorStop(0.6, '#040b12'); g.addColorStop(1, '#010407');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (S.layers.atm && sunAlt > -18) {
      var day = A.clamp((sunAlt + 6) / 14, 0, 1), tw = A.clamp((sunAlt + 18) / 12, 0, 1) * (1 - day);
      if (day > 0) { ctx.fillStyle = 'rgba(46,112,170,' + (0.5 * day) + ')'; ctx.fillRect(0, 0, W, H); }
      if (tw > 0) { ctx.fillStyle = 'rgba(38,52,96,' + (0.4 * tw) + ')'; ctx.fillRect(0, 0, W, H); }
    }
  }

  function drawMilkyWay(ctx, dim) {
    var sp = sprites().mw, s = 1 / degPerPx();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < mw.length; i++) {
      var m = mw[i], e = A.apply(M, m.v);
      if (!proj(e[0], e[1], e[2])) continue;
      var r = m.size * s * (gnomonic ? 1 : 2 / (1 + PZ));
      if (PX < -r || PX > W + r || PY < -r || PY > H + r) continue;
      ctx.globalAlpha = m.a * dim;
      ctx.drawImage(sp, PX - r, PY - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawDome(ctx, S, below) {
    var a, h;
    ctx.lineWidth = 1;
    // Círculos de altura
    for (h = below ? -80 : 10; below ? h < 0 : h <= 80; h += 10) {
      ctx.strokeStyle = below ? 'rgba(46,224,176,0.20)' : 'rgba(46,224,176,' + (h % 30 === 0 ? 0.17 : 0.085) + ')';
      (function (hh) { polyline(ctx, 91, function (i) { return A.enuFromAzAlt(i * 4, hh); }); })(h);
    }
    // Meridianos de azimut
    for (a = 0; a < 360; a += 15) {
      var main = a % 45 === 0;
      ctx.strokeStyle = below ? 'rgba(46,224,176,' + (main ? 0.26 : 0.15) + ')' : 'rgba(46,224,176,' + (main ? 0.17 : 0.085) + ')';
      (function (aa, top) {
        polyline(ctx, 19, function (i) { return A.enuFromAzAlt(aa, below ? -i * 5 : i * top / 18); });
      })(a, main ? 90 : 80);
    }
    if (!below && S.view.fov < 75) {
      ctx.fillStyle = 'rgba(46,224,176,0.5)';
      for (h = 10; h <= 80; h += 10) {
        if (projV(A.enuFromAzAlt(Math.round(S.view.az / 15) * 15, h)) && onScreen()) {
          ctx.font = '10px ' + FONT_UI; ctx.textAlign = 'left'; ctx.fillText(h + '°', PX + 4, PY - 3);
        }
      }
    }
  }

  function drawGround(ctx, S) {
    if (gnomonic) return;
    ctx.save();
    groundPath(ctx, S.view.az);
    ctx.fillStyle = S.layers.ground ? 'rgba(1,9,8,0.93)' : 'rgba(1,6,8,0.55)';
    ctx.fill('evenodd');
    if (S.layers.grid) { ctx.clip('evenodd'); drawDome(ctx, S, true); }
    ctx.restore();
  }

  function drawHorizon(ctx, S) {
    ctx.strokeStyle = 'rgba(70,240,190,0.75)'; ctx.lineWidth = 1.6;
    polyline(ctx, 181, function (i) { return A.enuFromAzAlt(i * 2, 0); });
    var es = S.lang === 'es';
    var names = es ? ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (var i = 0; i < 8; i++) {
      if (!projV(A.enuFromAzAlt(i * 45, 0)) || !onScreen(10)) continue;
      var big = i % 2 === 0;
      ctx.font = (big ? '700 15px ' : '600 11px ') + FONT_DISPLAY;
      ctx.textAlign = 'center';
      ctx.fillStyle = i === 4 ? '#ffc861' : (big ? 'rgba(120,255,214,0.95)' : 'rgba(120,255,214,0.6)');
      ctx.fillText(names[i], PX, PY - 8);
      labels.push([PX - 14, PY - 24, PX + 14, PY - 4]);
    }
  }

  function drawGreatCircles(ctx, S) {
    ctx.setLineDash([2, 7]); ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,196,92,0.55)';
    polyline(ctx, 121, function (i) {
      var l = i * 3 * RAD; return A.apply(M, A.eclToEqu0([Math.cos(l), Math.sin(l), 0]));
    });
    ctx.strokeStyle = 'rgba(120,170,255,0.45)';
    polyline(ctx, 121, function (i) {
      var l = i * 3 * RAD; return A.apply(Md, [Math.cos(l), Math.sin(l), 0]);
    });
    ctx.setLineDash([]);
  }

  function drawConstellations(ctx, S) {
    var i, j, a, e;
    if (S.layers.lines) {
      ctx.strokeStyle = 'rgba(126,178,255,0.30)'; ctx.lineWidth = 1;
      ctx.beginPath();
      var jump = Math.max(W, H) * 0.6;
      for (i = 0; i < conLines.length; i++) {
        a = conLines[i]; var pen = false, lx = 0, ly = 0;
        for (j = 0; j < a.length; j += 3) {
          var x = a[j], y = a[j + 1], z = a[j + 2];
          if (!proj(M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z)) { pen = false; continue; }
          if (pen && Math.abs(PX - lx) + Math.abs(PY - ly) < jump) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY);
          pen = true; lx = PX; ly = PY;
        }
      }
      ctx.stroke();
    }
    if (fx.hiCon) drawConHighlight(ctx);
    if (S.layers.conNames) {
      var maxRank = S.view.fov > 95 ? 1 : (S.view.fov > 60 ? 2 : 3);
      for (i = 0; i < conLabels.length; i++) {
        var c = conLabels[i];
        if (c.rank > maxRank) continue;
        e = A.apply(M, c.v);
        if ((e[2] < 0.04 && !gnomonic) || !proj(e[0], e[1], e[2]) || !onScreen()) continue;
        label(ctx, (S.lang === 'es' ? c.es : c.en).toUpperCase(), PX, PY, '600 10px ' + FONT_DISPLAY, 'rgba(140,186,255,0.62)', false, 'center');
      }
    }
  }

  // Figura de la constelación seleccionada: se «dibuja» al elegirla
  function drawConHighlight(ctx) {
    var k = fx.reduce ? 1 : A.clamp((tNow - fx.selT) / 750, 0, 1), e = 1 - Math.pow(1 - k, 3), i, j, a;
    var jump = Math.max(W, H) * 0.6;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(160,210,255,0.9)'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(110,175,255,0.95)'; ctx.shadowBlur = 9;
    if (k < 1) ctx.setLineDash([Math.max(0.01, 1100 * e), 6000]);
    ctx.beginPath();
    for (i = 0; i < conLines.length; i++) {
      if (conLineId[i] !== fx.hiCon) continue;
      a = conLines[i]; var pen = false, lx = 0, ly = 0;
      for (j = 0; j < a.length; j += 3) {
        var x = a[j], y = a[j + 1], z = a[j + 2];
        if (!proj(M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z)) { pen = false; continue; }
        if (pen && Math.abs(PX - lx) + Math.abs(PY - ly) < jump) ctx.lineTo(PX, PY); else ctx.moveTo(PX, PY);
        pen = true; lx = PX; ly = PY;
      }
    }
    ctx.stroke(); ctx.restore();
  }
  function conOfSel(sel) {
    if (!sel) return null;
    if (sel.kind === 'con') return conLabels[sel.id].id;
    if (sel.kind === 'star') { var n = CATALOG.names[sel.id], ab = n && n[2] ? n[2].split(' ')[1] : ''; return ab && CATALOG.lines[ab] ? ab : null; }
    return null;
  }

  function starName(i, lang) {
    var n = CATALOG.names[i]; if (!n) return '';
    return (lang === 'es' && n[1]) ? n[1] : (n[0] || n[2]);
  }

  function drawStars(ctx, S, lim, dim) {
    var sp = sprites(), s = Math.min(1.45, Math.max(0.85, Math.sqrt(70 / (gnomonic ? S.camFov : S.view.fov))));
    var i, x, y, z, e, n, u, r, m, twk = fx.on, tt = tNow / 1000;
    for (i = 0; i < N; i++) {
      m = smag[i];
      if (m > lim) break;
      x = sv[i * 3]; y = sv[i * 3 + 1]; z = sv[i * 3 + 2];
      e = M[0] * x + M[1] * y + M[2] * z; n = M[3] * x + M[4] * y + M[5] * z; u = M[6] * x + M[7] * y + M[8] * z;
      senu[i * 3] = e; senu[i * 3 + 1] = n; senu[i * 3 + 2] = u;
      if (u < -0.02 && !gnomonic) continue;
      if (!proj(e, n, u) || PX < -8 || PX > W + 8 || PY < -8 || PY > H + 8) continue;
      r = Math.max(0.55, (lim + 1.1 - m) * 0.4 * s);
      // Centelleo: más marcado cerca del horizonte, como en el cielo real
      var tw = 1;
      if (twk && m < 3.8) {
        var hz = 1 - Math.max(0, u), ph = tt * (2.1 + (i % 7) * 0.37) + i * 2.399;
        tw = 1 + (0.06 + 0.3 * hz * hz * hz) * (0.62 * Math.sin(ph) + 0.38 * Math.sin(ph * 2.7 + 1.3));
      }
      if (m < 2.7) {
        var img = scol[i] > 3 ? sp.warm : sp.star, gr = r * (m < 1.6 ? 5.5 : 4.2) * tw;
        ctx.globalAlpha = (m < 1.6 ? 0.55 : 0.3) * dim;
        ctx.drawImage(img, PX - gr, PY - gr, gr * 2, gr * 2);
        if (m < 0.9 && fx.on) {                     // destellos de difracción en las más brillantes
          var sl = r * (8.5 - m * 3) * tw; ctx.globalAlpha = 0.5 * dim;
          ctx.drawImage(img, PX - sl, PY - 1.1, sl * 2, 2.2); ctx.drawImage(img, PX - 1.1, PY - sl, 2.2, sl * 2);
        }
      }
      ctx.fillStyle = COLORS[scol[i]];
      if (r < 1.05) { ctx.globalAlpha = Math.min(1, (0.45 + r * 0.55) * tw) * dim; ctx.fillRect(PX - r, PY - r, r * 2, r * 2); }
      else { ctx.globalAlpha = Math.min(1, tw) * dim; ctx.beginPath(); ctx.arc(PX, PY, r, 0, 6.2832); ctx.fill(); }
      picks.push(PX, PY, 0, i, r + 4);
    }
    ctx.globalAlpha = 1;
    if (!S.layers.starNames) return;
    ctx.globalAlpha = lineA;
    var nameLim = Math.min(lim, S.view.fov > 90 ? 1.6 : S.view.fov > 55 ? 2.6 : S.view.fov > 35 ? 3.4 : 4.2);
    for (i = 0; i < N && smag[i] <= nameLim; i++) {
      var nm = starName(i, S.lang);
      if (!nm) continue;
      if (senu[i * 3 + 2] < 0 && !gnomonic) continue;
      if (!proj(senu[i * 3], senu[i * 3 + 1], senu[i * 3 + 2]) || !onScreen()) continue;
      label(ctx, nm, PX + 7, PY - 5, (smag[i] < 1.2 ? '600 12px ' : '500 11px ') + FONT_UI, smag[i] < 1.2 ? 'rgba(236,244,255,0.92)' : 'rgba(200,216,240,0.62)');
    }
    ctx.globalAlpha = 1;
  }

  // Resplandor sobre el horizonte: luminiscencia tenue y arco cálido hacia el Sol en el crepúsculo
  function drawHorizonGlow(ctx, S, sunAlt) {
    if (gnomonic || !S.layers.atm) return;
    var w = A.clamp(7 / degPerPx(), 26, 150), i;
    var glow = [[1, 0.035], [0.55, 0.045], [0.22, 0.06]];
    ctx.lineCap = 'butt';
    for (i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(70,150,190,' + glow[i][1] + ')'; ctx.lineWidth = w * glow[i][0];
      polyline(ctx, 91, function (j) { return A.enuFromAzAlt(j * 4, 0); });
    }
    var tw = A.clamp((sunAlt + 16) / 11, 0, 1) * A.clamp((7 - sunAlt) / 8, 0, 1);
    if (tw > 0.02) {
      var az = bodies.sun.az, arcs = [[75, 0.05, 1.5], [45, 0.08, 1.1], [22, 0.11, 0.7]];
      for (i = 0; i < 3; i++) {
        ctx.strokeStyle = 'rgba(255,' + (150 + i * 14) + ',90,' + (arcs[i][1] * tw) + ')'; ctx.lineWidth = w * arcs[i][2];
        (function (half) { polyline(ctx, 31, function (j) { return A.enuFromAzAlt(az - half + j * half / 15, 0); }); })(arcs[i][0]);
      }
    }
    ctx.lineWidth = 1;
  }

  // Estrellas fugaces decorativas (no son un pronóstico). Nunca con sensores ni cámara.
  function drawMeteors(ctx, S, sunAlt) {
    var ms = fx.meteors, i;
    if (!fx.on || gnomonic || S.sensor || sunAlt > -8 || Math.abs(S.rate) > 60) { ms.length = 0; fx.nextMeteor = 0; return; }
    if (!fx.nextMeteor) fx.nextMeteor = tNow + 3500 + Math.random() * 6000;
    if (tNow > fx.nextMeteor) {
      fx.nextMeteor = tNow + 7000 + Math.random() * 15000;
      var az = S.view.az + (Math.random() - 0.5) * S.view.fov * 1.1, alt = A.clamp(S.view.alt + (Math.random() - 0.3) * S.view.fov * 0.5, 22, 80);
      ms.push({ a: A.enuFromAzAlt(az, alt), b: A.enuFromAzAlt(az + (Math.random() - 0.5) * 44, alt - 7 - Math.random() * 15), t0: tNow, dur: 520 + Math.random() * 480, w: 1.2 + Math.random() * 1.1 });
    }
    for (i = ms.length - 1; i >= 0; i--) {
      var m = ms[i], k = (tNow - m.t0) / m.dur;
      if (k >= 1) { ms.splice(i, 1); continue; }
      var k0 = Math.max(0, k - 0.38), hx, hy;
      if (!proj(m.a[0] + (m.b[0] - m.a[0]) * k, m.a[1] + (m.b[1] - m.a[1]) * k, m.a[2] + (m.b[2] - m.a[2]) * k)) continue;
      hx = PX; hy = PY;
      if (!proj(m.a[0] + (m.b[0] - m.a[0]) * k0, m.a[1] + (m.b[1] - m.a[1]) * k0, m.a[2] + (m.b[2] - m.a[2]) * k0)) continue;
      var al = Math.sin(Math.PI * k), g = ctx.createLinearGradient(PX, PY, hx, hy);
      g.addColorStop(0, 'rgba(190,220,255,0)'); g.addColorStop(1, 'rgba(255,255,255,' + (0.95 * al) + ')');
      ctx.strokeStyle = g; ctx.lineWidth = m.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(PX, PY); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.globalAlpha = 0.8 * al; ctx.drawImage(sprites().star, hx - 7, hy - 7, 14, 14); ctx.globalAlpha = 1;
    }
    ctx.lineCap = 'butt';
  }

  function drawDsos(ctx, S, dim) {
    var sp = sprites(), s = 1 / degPerPx(), i;
    for (i = 0; i < dsos.length; i++) {
      var o = dsos[i], d = o.d, e = A.apply(M, o.v);
      o.enu = e;
      if (e[2] < -0.02 && !gnomonic) continue;
      if (!proj(e[0], e[1], e[2]) || !onScreen(60)) continue;
      var k = gnomonic ? 1 : 2 / (1 + PZ), r = Math.max(5, d.size * s * k / 2), x = PX, y = PY;
      if (d.type === 'dark') {
        ctx.fillStyle = 'rgba(0,4,8,' + (0.55 * dim) + ')'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0.5, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(160,190,220,0.25)'; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      } else if (d.type === 'center') {
        ctx.strokeStyle = 'rgba(255,200,97,0.85)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
        ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12); ctx.stroke();
      } else {
        var img = d.type === 'nebula' ? sp.neb : d.type === 'galaxy' ? sp.gal : sp.clu;
        var gr = Math.max(9, r * 1.5);
        ctx.globalAlpha = (d.size > 2 ? 0.55 : 0.8) * dim; ctx.drawImage(img, x - gr, y - gr, gr * 2, gr * 2); ctx.globalAlpha = 1;
        ctx.strokeStyle = d.type === 'nebula' ? 'rgba(255,150,190,0.7)' : d.type === 'galaxy' ? 'rgba(170,196,255,0.7)' : 'rgba(255,230,170,0.7)';
        ctx.lineWidth = 1;
        var q = Math.min(r, 9);
        ctx.beginPath();
        if (d.type === 'galaxy') ctx.ellipse(x, y, q, q * 0.55, -0.5, 0, 6.2832);
        else if (d.type === 'nebula') ctx.rect(x - q * 0.8, y - q * 0.8, q * 1.6, q * 1.6);
        else { ctx.setLineDash(d.type === 'cluster' ? [2, 3] : []); ctx.arc(x, y, q, 0, 6.2832); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      picks.push(x, y, 1, i, Math.max(14, Math.min(r, 40)));
      if (d.prio >= (S.view.fov > 80 ? 8 : S.view.fov > 45 ? 6 : 3))
        label(ctx, d.name[S.lang], x + Math.min(r, 12) + 5, y + 4, '500 11px ' + FONT_UI, 'rgba(255,214,170,0.85)');
    }
  }

  function drawMoon(ctx, x, y, r, illum, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#1b2230'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#eef2fa'; ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    if (illum < 0.5) ctx.ellipse(0, 0, Math.max(0.01, r * (1 - 2 * illum)), r, 0, Math.PI / 2, -Math.PI / 2, true);
    else ctx.ellipse(0, 0, Math.max(0.01, r * (2 * illum - 1)), r, 0, Math.PI / 2, Math.PI * 1.5, false);
    ctx.fill(); ctx.restore();
  }

  function drawBodies(ctx, S) {
    var sp = sprites(), ids = ['neptune', 'uranus', 'saturn', 'jupiter', 'mars', 'venus', 'mercury', 'sun', 'moon'];
    var s = 1 / degPerPx();
    ids.forEach(function (id) {
      var b = bodies[id], info = CONTENT.bodies[id];
      if (b.altApp < -1 && !gnomonic) return;
      var e = A.enuFromAzAlt(b.az, b.altApp);
      if (!proj(e[0], e[1], e[2]) || !onScreen(40)) return;
      var x = PX, y = PY, r;
      if (id === 'sun') {
        r = Math.max(8, b.semidiam * s); ctx.globalAlpha = 0.9; ctx.drawImage(sp.sun, x - r * 6, y - r * 6, r * 12, r * 12); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      } else if (id === 'moon') {
        r = Math.max(8, b.semidiam * s);
        ctx.globalAlpha = 0.35 + 0.4 * b.illum; ctx.drawImage(sp.moon, x - r * 4, y - r * 4, r * 8, r * 8); ctx.globalAlpha = 1;
        // El limbo iluminado apunta hacia el Sol
        var se = A.enuFromAzAlt(bodies.sun.az, bodies.sun.alt), t = 0.02;
        var q = [e[0] + (se[0] - e[0]) * t, e[1] + (se[1] - e[1]) * t, e[2] + (se[2] - e[2]) * t];
        var p2 = gnomonic ? (projV(q) ? [PX, PY] : [x + 1, y]) : stereo(q);
        drawMoon(ctx, x, y, r, b.illum, Math.atan2(p2[1] - y, p2[0] - x));
      } else {
        r = A.clamp(4.4 - b.mag * 0.55, 2.4, 6.5);
        ctx.globalAlpha = 0.7; ctx.drawImage(sp.star, x - r * 4.5, y - r * 4.5, r * 9, r * 9); ctx.globalAlpha = 1;
        ctx.fillStyle = info.color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        if (id === 'saturn') { ctx.strokeStyle = 'rgba(236,217,160,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, r * 2.1, r * 0.6, -0.35, 0, 6.2832); ctx.stroke(); }
      }
      picks.push(x, y, 2, ids.indexOf(id), Math.max(16, r + 8));
      if (id === 'uranus' || id === 'neptune') { if (S.view.fov > 50) return; }
      label(ctx, info.name[S.lang], x + r + 6, y + 4, '700 12px ' + FONT_DISPLAY, info.color, true);
    });
    Sky.bodyIds = ids;
  }

  // Puntero de la Cruz del Sur al polo sur celeste
  function drawPointer(ctx, S) {
    var lat = S.site.lat; if (lat > -5) return;
    var gi = CATALOG.special.gacrux * 3, ai = CATALOG.special.acrux * 3;
    var g = [senu[gi], senu[gi + 1], senu[gi + 2]], a = [senu[ai], senu[ai + 1], senu[ai + 2]];
    if (a[2] < -0.2) return;
    var d = A.angSep(g, a) * RAD;
    var ax = [g[1] * a[2] - g[2] * a[1], g[2] * a[0] - g[0] * a[2], g[0] * a[1] - g[1] * a[0]];
    var l = Math.sqrt(ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2]); ax = [ax[0] / l, ax[1] / l, ax[2] / l];
    var t = [ax[1] * a[2] - ax[2] * a[1], ax[2] * a[0] - ax[0] * a[2], ax[0] * a[1] - ax[1] * a[0]];
    ctx.strokeStyle = 'rgba(255,200,97,0.8)'; ctx.lineWidth = 1.3; ctx.setLineDash([5, 5]);
    polyline(ctx, 25, function (i) {
      var th = i / 24 * 4.5 * d, c = Math.cos(th), s = Math.sin(th);
      return [a[0] * c + t[0] * s, a[1] * c + t[1] * s, a[2] * c + t[2] * s];
    });
    var pole = A.enuFromAzAlt(180, -lat);
    ctx.strokeStyle = 'rgba(255,200,97,0.4)';
    polyline(ctx, 13, function (i) { return A.enuFromAzAlt(180, -lat * (1 - i / 12)); });
    ctx.setLineDash([]);
    if (projV(pole) && onScreen()) {
      ctx.strokeStyle = '#ffc861'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(PX - 7, PY); ctx.lineTo(PX + 7, PY); ctx.moveTo(PX, PY - 7); ctx.lineTo(PX, PY + 7); ctx.stroke();
      label(ctx, S.lang === 'es' ? 'Polo sur celeste' : 'South celestial pole', PX + 10, PY - 6, '600 11px ' + FONT_UI, '#ffc861', true);
    }
  }

  function drawReticle(ctx, S, now) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(CX, CY, 15, 0, 6.2832);
    ctx.moveTo(CX - 24, CY); ctx.lineTo(CX - 15, CY); ctx.moveTo(CX + 15, CY); ctx.lineTo(CX + 24, CY);
    ctx.moveTo(CX, CY - 24); ctx.lineTo(CX, CY - 15); ctx.moveTo(CX, CY + 15); ctx.lineTo(CX, CY + 24); ctx.stroke();
    if (!S.sel) return;
    var v = dirOf(S.sel); if (!v) return;
    var vis = proj(v[0], v[1], v[2]) && onScreen(-30);
    var pulse = fx.reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 320);
    if (vis) {
      // Enganche: el anillo se cierra sobre el objeto y cuatro arcos giran a su alrededor
      var lk = fx.reduce ? 1 : A.clamp((now - fx.selT) / 560, 0, 1), le = 1 - Math.pow(1 - lk, 3);
      var rr = 15 + pulse * 3 + (1 - le) * 52, rot = fx.reduce ? 0.7854 : now / 1500 + (1 - le) * 2.6, q;
      ctx.strokeStyle = 'rgba(255,200,97,' + ((0.65 + 0.35 * pulse) * le) + ')'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(PX, PY, rr, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(PX, PY, rr + 7, rot + q * 1.5708 - 0.3, rot + q * 1.5708 + 0.3); ctx.stroke(); }
      ctx.lineCap = 'butt';
      if (lk < 1) { ctx.strokeStyle = 'rgba(255,200,97,' + (0.5 * (1 - lk)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(PX, PY, 15 + le * 70, 0, 6.2832); ctx.stroke(); }
      Sky.guide = null;
    } else {
      // Flecha en el borde, apuntando hacia el objeto
      var x = v[0] * R[0] + v[1] * R[1] + v[2] * R[2], y = v[0] * U[0] + v[1] * U[1] + v[2] * U[2];
      var ang = Math.atan2(-y, x), m = Math.min(W, H) / 2 - 58;
      var gx = CX + Math.cos(ang) * m, gy = CY + Math.sin(ang) * m;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,200,97,' + (0.7 + 0.3 * pulse) + ')';
      ctx.beginPath(); ctx.moveTo(18 + pulse * 5, 0); ctx.lineTo(-6, -11); ctx.lineTo(-1, 0); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      var sep = Math.round(A.angSep(v, F));
      ctx.font = '700 12px ' + FONT_DISPLAY; ctx.textAlign = 'center'; ctx.fillStyle = '#ffc861';
      ctx.fillText(sep + '°', CX + Math.cos(ang) * (m - 26), CY + Math.sin(ang) * (m - 26) + 4);
      Sky.guide = sep;
    }
  }

  // Objeto bajo el cursor (solo ratón): anillo fino y nombre
  function drawHover(ctx, S) {
    var hv = Sky.hover; if (!hv) return;
    if (S.sel && S.sel.kind === hv.sel.kind && S.sel.id === hv.sel.id) return;
    var v = dirOf(hv.sel); if (!v || !proj(v[0], v[1], v[2]) || !onScreen()) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(PX, PY, 11, 0, 6.2832); ctx.stroke();
    if (!hv.name) return;
    ctx.font = '600 12px ' + FONT_UI;
    var w = ctx.measureText(hv.name).width, x = Math.min(PX + 16, W - w - 14), y = Math.max(PY - 14, 20);
    ctx.fillStyle = 'rgba(4,16,22,0.92)'; ctx.strokeStyle = 'rgba(70,240,190,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(x - 7, y - 14, w + 14, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8f2f4'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(hv.name, x, y);
  }

  /* ---------- API ---------- */
  // Dirección ENU (aparente) de un objeto seleccionado
  function dirOf(sel) {
    if (!sel || !M) return null;
    if (sel.kind === 'star') { var i = sel.id * 3; return A.apply(M, [sv[i], sv[i + 1], sv[i + 2]]); }
    if (sel.kind === 'dso') return A.apply(M, dsos[sel.id].v);
    if (sel.kind === 'con') { var c = conLabels[sel.id]; return A.apply(M, c.v); }
    if (sel.kind === 'body') { var b = bodies[sel.id]; return b ? A.enuFromAzAlt(b.az, b.altApp) : null; }
    return null;
  }

  function update(S) {
    jdNow = A.jdFromMs(S.t);
    M = A.skyMatrix(jdNow, S.site.lat, S.site.lon);
    Md = A.dateMatrix(jdNow, S.site.lat, S.site.lon);
    var ids = ['sun', 'moon'].concat(A.PLANETS);
    for (var i = 0; i < ids.length; i++) bodies[ids[i]] = A.horizontal(ids[i], jdNow, S.site);
  }

  function render(ctx, w, h, S, now) {
    W = w; H = h; CX = W / 2; CY = H / 2;
    setCamera(S); update(S);
    picks.length = 0; labels.length = 0;
    tNow = now; fx.on = S.layers.fx !== false && !fx.reduce;
    var selKey = S.sel ? S.sel.kind + ':' + S.sel.id : '';
    if (selKey !== fx.selKey) { fx.selKey = selKey; fx.selT = now; fx.hiCon = conOfSel(S.sel); }
    // Entrada: las estrellas se encienden de la más brillante a la más tenue
    var it = (now - fx.intro0) / 1000, introK = it >= 1.7 ? 1 : A.clamp(it / 1.7, 0, 1);
    var starRev = it >= 1.1 ? 1 : 1 - Math.pow(1 - A.clamp(it / 1.1, 0, 1), 3);
    lineA = introK * introK;
    var sunAlt = bodies.sun.alt, fov = gnomonic ? S.camFov : S.view.fov;
    var day = S.layers.atm ? A.clamp((sunAlt + 6) / 12, 0, 1) : 0;
    var lim = Math.min(S.magLimit, A.clamp(6.7 - Math.log(fov / 40) / Math.LN2 * 1.1, 4.2, 6.5));
    if (day > 0) lim = Math.min(lim, 5.6 - 2.2 * day);
    if (starRev < 1) lim -= (1 - starRev) * 6.5;
    var dim = 1 - 0.45 * day;
    // Luz de Luna: apaga un poco la Vía Láctea
    var moonWash = bodies.moon.alt > 0 ? bodies.moon.illum : 0;

    drawBackground(ctx, S, sunAlt);
    if (S.layers.mw) drawMilkyWay(ctx, (1 - 0.8 * day) * (1 - 0.55 * moonWash) * introK);
    ctx.globalAlpha = lineA;
    if (S.layers.grid) drawDome(ctx, S, false);
    if (S.layers.equ) drawGreatCircles(ctx, S);
    drawConstellations(ctx, S);
    ctx.globalAlpha = 1;
    drawStars(ctx, S, lim, dim);
    if (S.layers.dso) drawDsos(ctx, S, dim * lineA);
    drawMeteors(ctx, S, sunAlt);
    if (S.layers.pointer && lineA > 0.5) drawPointer(ctx, S);
    drawHorizonGlow(ctx, S, sunAlt);
    drawGround(ctx, S);
    drawHorizon(ctx, S);
    drawBodies(ctx, S);
    drawHover(ctx, S);
    drawReticle(ctx, S, now);
    Sky.sunAlt = sunAlt;
  }

  // Objeto más cercano a un punto de pantalla
  function pick(x, y, slack) {
    var best = null, bd = 1e9;
    for (var i = 0; i < picks.length; i += 5) {
      var dx = picks[i] - x, dy = picks[i + 1] - y, d = Math.sqrt(dx * dx + dy * dy), lim = picks[i + 4] + (slack || 10);
      if (d > lim) continue;
      // Sol, Luna, planetas y cielo profundo ganan a las estrellas de fondo
      var score = d - (picks[i + 2] === 2 ? 14 : picks[i + 2] === 1 ? 8 : Math.max(0, 4 - smag[picks[i + 3]]) * 2.2);
      if (score < bd) { bd = score; best = i; }
    }
    if (best === null) return null;
    var k = picks[best + 2], id = picks[best + 3];
    return k === 0 ? { kind: 'star', id: id } : k === 1 ? { kind: 'dso', id: id } : { kind: 'body', id: Sky.bodyIds[id] };
  }

  // Constelación cuyo centro queda más cerca de una dirección ENU
  function nearestConstellation(v) {
    var best = -1, bd = 999;
    for (var i = 0; i < conLabels.length; i++) {
      var d = A.angSep(A.apply(M, conLabels[i].v), v);
      if (d < bd) { bd = d; best = i; }
    }
    return best < 0 ? null : conLabels[best];
  }

  var FONT_UI = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
  var FONT_DISPLAY = '"Chakra Petch", "Trebuchet MS", system-ui, sans-serif';

  return {
    N: N, smag: smag, scol: scol, sv: sv, dsos: dsos, conLabels: conLabels, COLORS: COLORS,
    render: render, update: update, pick: pick, dirOf: dirOf, starName: starName,
    nearestConstellation: nearestConstellation, degPerPx: degPerPx,
    bodies: bodies, bodyIds: [], guide: null, sunAlt: 0, hover: null, fx: fx,
    unproject: unproject, setCamera: function (S) { setCamera(S); }, intro: function (now) { fx.intro0 = now; },
    matrix: function () { return M; },
    FONT_UI: FONT_UI, FONT_DISPLAY: FONT_DISPLAY
  };
})();
