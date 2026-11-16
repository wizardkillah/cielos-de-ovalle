/* =====================================================================
   app.js — Estado, interfaz, gestos, sensores y bucle principal
   ===================================================================== */
(function () {
  'use strict';
  var A = Astro, RAD = A.RAD, DEG = A.DEG;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Estado ---------- */
  var S = {
    lang: 'es', mode: 'sky',
    site: { name: CONTENT.sites[0].name, lat: CONTENT.sites[0].lat, lon: CONTENT.sites[0].lon },
    t: Date.now(), rate: 1, live: true,
    view: { az: 180, alt: 38, fov: 95 },
    cam: { R: [1, 0, 0], U: [0, 0, 1], F: [0, 1, 0] },
    sensor: false, camera: false, camFov: 62, azOffset: 0,
    layers: { lines: true, conNames: true, starNames: true, grid: true, equ: false, mw: true, dso: true, pointer: true, ground: true, atm: true, fx: true },
    magLimit: 6.5, sel: null, red: false
  };
  var store = {
    load: function () {
      try {
        var o = JSON.parse(localStorage.getItem('cielos-ovalle-v1') || 'null'); if (!o) return false;
        ['lang', 'magLimit', 'red', 'camFov', 'azOffset'].forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
        if (o.site && isFinite(o.site.lat) && isFinite(o.site.lon)) S.site = o.site;
        if (o.layers) Object.keys(S.layers).forEach(function (k) { if (typeof o.layers[k] === 'boolean') S.layers[k] = o.layers[k]; });
        return !!o.seen;
      } catch (e) { return false; }
    },
    save: function (seen) {
      try {
        localStorage.setItem('cielos-ovalle-v1', JSON.stringify({
          lang: S.lang, magLimit: S.magLimit, red: S.red, camFov: S.camFov, azOffset: S.azOffset,
          site: S.site, layers: S.layers, seen: seen === undefined ? true : seen
        }));
      } catch (e) { /* almacenamiento no disponible: la app funciona igual */ }
    }
  };

  // «Movimiento reducido» del sistema: sin inercia, entrada, centelleo ni giros automáticos
  var REDUCE = false;
  try { REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* sin matchMedia */ }
  Sky.fx.reduce = REDUCE;

  /* ---------- Texto ---------- */
  function T(k) { return I18N[S.lang][k]; }
  function fmt(s) { var a = arguments; return s.replace(/\{(\d)\}/g, function (m, i) { return a[+i + 1]; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, d) { return v.toFixed(d === undefined ? 1 : d).replace('.', S.lang === 'es' ? ',' : '.'); }
  function dir8(az) { return Math.round(A.norm360(az) / 45) % 8; }

  /* ---------- Hora local del lugar ---------- */
  function tz() {
    var s = S.site;
    return (s.lat < -17 && s.lat > -56.5 && s.lon > -76 && s.lon < -66) ? 'America/Santiago' : undefined;
  }
  function parts(ms) {
    var o = { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    var z = tz(); if (z) o.timeZone = z;
    var p = {}, f;
    try { f = new Intl.DateTimeFormat('en-US', o).formatToParts(new Date(ms)); }
    catch (e) { delete o.timeZone; f = new Intl.DateTimeFormat('en-US', o).formatToParts(new Date(ms)); }
    f.forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, H: +p.hour % 24, M: +p.minute };
  }
  function fromWall(y, m, d, H, M) {
    var guess = Date.UTC(y, m - 1, d, H, M);
    for (var i = 0; i < 3; i++) {
      var p = parts(guess), got = Date.UTC(p.y, p.m - 1, p.d, p.H, p.M);
      guess += Date.UTC(y, m - 1, d, H, M) - got;
    }
    return guess;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var p = parts(ms); return p2(p.H) + ':' + p2(p.M); }
  function dateLabel(ms) {
    var o = W < 480 ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' }, z = tz(); if (z) o.timeZone = z;
    try { return new Intl.DateTimeFormat(S.lang === 'es' ? 'es-CL' : 'en-GB', o).format(new Date(ms)).replace(/\./g, ''); }
    catch (e) { return new Date(ms).toDateString(); }
  }
  function jd() { return A.jdFromMs(S.t); }

  /* ---------- Cámara virtual ---------- */
  function camFromView() {
    var a = S.view.az * RAD, h = S.view.alt * RAD, ca = Math.cos(a), sa = Math.sin(a), ch = Math.cos(h), sh = Math.sin(h);
    S.cam.F = [sa * ch, ca * ch, sh]; S.cam.R = [ca, -sa, 0]; S.cam.U = [-sa * sh, -ca * sh, ch];
  }

  /* ---------- Sensores de orientación ---------- */
  var sens = { seen: false, abs: false, rel: false, R: null, U: null, F: null, wake: null };
  function onOrient(e) {
    if (!S.sensor || e.alpha === null || e.alpha === undefined) return;
    var alpha;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) { alpha = 360 - e.webkitCompassHeading; sens.abs = true; }
    else if (e.absolute === true || e.type === 'deviceorientationabsolute') { alpha = e.alpha; sens.abs = true; }
    else { if (sens.abs) return; alpha = e.alpha; if (!sens.rel) { sens.rel = true; toast(T('relCompass'), 6000); } }
    sens.seen = true;
    var al = (alpha - S.azOffset) * RAD, be = (e.beta || 0) * RAD, ga = (e.gamma || 0) * RAD;
    var cA = Math.cos(al), sA = Math.sin(al), cB = Math.cos(be), sB = Math.sin(be), cG = Math.cos(ga), sG = Math.sin(ga);
    // Columnas de la matriz de rotación W3C (mundo: X este, Y norte, Z arriba)
    var X = [cA * cG - sA * sB * sG, cG * sA + cA * sB * sG, -cB * sG];
    var Y = [-cB * sA, cA * cB, sB];
    var Z = [cG * sA * sB + cA * sG, sA * sG - cA * cG * sB, cB * cG];
    // Rotación de pantalla (apaisado)
    var so = (window.screen && screen.orientation && screen.orientation.angle) || window.orientation || 0, r = so * RAD;
    var cr = Math.cos(r), sr = Math.sin(r);
    // Con la pantalla girada 90° (apaisado), «arriba» en pantalla es el eje X del aparato
    var Uu = [X[0] * sr + Y[0] * cr, X[1] * sr + Y[1] * cr, X[2] * sr + Y[2] * cr];
    var Ff = [-Z[0], -Z[1], -Z[2]];
    // Filtro de paso bajo sobre la base y re-ortonormalización
    var k = sens.F ? 0.18 : 1;
    sens.F = mixn(sens.F, Ff, k); sens.U = mixn(sens.U, Uu, k);
    var f = sens.F, u = sens.U, d = f[0] * u[0] + f[1] * u[1] + f[2] * u[2];
    u = norm([u[0] - d * f[0], u[1] - d * f[1], u[2] - d * f[2]]); sens.U = u;
    sens.R = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];   // R = F × U
  }
  function norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function mixn(a, b, k) { if (!a) return norm(b); return norm([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); }

  function startSensor() {
    var DOE = window.DeviceOrientationEvent;
    if (!DOE) { toast(T('noSensor')); return; }
    if (window.isSecureContext === false) { toast(T('needHttps'), 6000); return; }
    function go() {
      sens.seen = false; sens.abs = false; sens.rel = false; sens.F = sens.U = sens.R = null;
      S.sensor = true; anim = null; glide = null; zoomGoal = null; refreshRail();
      window.addEventListener('deviceorientationabsolute', onOrient, true);
      window.addEventListener('deviceorientation', onOrient, true);
      toast(T('sensorOn'), 5000);
      setTimeout(function () { if (S.sensor && !sens.seen) { stopSensor(); toast(T('noSensor')); } }, 2600);
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { sens.wake = w; }, function () {}); } catch (e) { /* opcional */ }
    }
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission().then(function (r) { if (r === 'granted') go(); else toast(T('sensorDenied')); }, function () { toast(T('sensorDenied')); });
    } else go();
  }
  function stopSensor() {
    window.removeEventListener('deviceorientationabsolute', onOrient, true);
    window.removeEventListener('deviceorientation', onOrient, true);
    S.sensor = false; stopCamera();
    try { if (sens.wake) { sens.wake.release(); sens.wake = null; } } catch (e) { /* opcional */ }
    S.view.alt = A.clamp(S.view.alt, -5, 90);
    refreshRail();
  }
  var stream = null;
  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast(T(window.isSecureContext === false ? 'needHttps' : 'camDenied'), 6000); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (st) {
      stream = st; var v = $('cam'); v.srcObject = st; v.play().catch(function () {});
      S.camera = true; document.body.classList.add('ar'); refreshRail();
    }, function () { toast(T('camDenied')); });
  }
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    $('cam').srcObject = null; S.camera = false; document.body.classList.remove('ar'); refreshRail();
  }

  /* ---------- Lienzo ---------- */
  var cv = $('view'), ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- Gestos ---------- */
  var ptrs = {}, gesture = null, anim = null;
  var glide = null;                    // inercia del arrastre en el cielo (°/s)
  var spin = { yaw: 0, pitch: 0 };     // inercia y giro lento en Cosmos (rad/s)
  var zoomGoal = null, zoomAt = null;  // zoom suave hacia un campo objetivo, anclado al cursor
  var ripples = [], lastTap = null;
  function pcount() { return Object.keys(ptrs).length; }
  function nameOf(sel) {
    if (sel.kind === 'body') return CONTENT.bodies[sel.id].name[S.lang];
    if (sel.kind === 'dso') return Sky.dsos[sel.id].d.name[S.lang];
    if (sel.kind === 'star') return Sky.starName(sel.id, S.lang);
    return '';
  }
  function hoverAt(x, y) {
    var hit = null;
    if (S.mode === 'sky') { hit = Sky.pick(x, y, 5); Sky.hover = hit ? { sel: hit, name: nameOf(hit) } : null; }
    else { hit = Cosmos.pick(x, y); Sky.hover = null; }
    cv.style.cursor = hit ? 'pointer' : '';
  }
  cv.addEventListener('pointerleave', function () { Sky.hover = null; cv.style.cursor = ''; });
  cv.addEventListener('pointerdown', function (e) {
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* sin captura */ }
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    if (anim && anim.fov1 !== S.view.fov) { zoomGoal = anim.fov1; zoomAt = null; }   // el campo termina de llegar
    glide = null; spin.yaw = 0; spin.pitch = 0; Sky.hover = null; cv.style.cursor = '';
    var n = pcount();
    if (n === 1) gesture = { x0: e.clientX, y0: e.clientY, t0: Date.now(), moved: false };
    if (n === 2) { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), fov: S.view.fov, span: Cosmos.view.goal, moved: true }; }
    anim = null;
  });
  cv.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId];
    if (!p && e.pointerType === 'mouse' && pcount() === 0) { hoverAt(e.clientX, e.clientY); return; }
    if (!p || !gesture) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y, dtm = Math.max(4, e.timeStamp - p.t) / 1000;
    p.x = e.clientX; p.y = e.clientY; p.t = e.timeStamp;
    if (pcount() === 2 && gesture.pinch) {
      var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomGoal = null;
      if (S.mode === 'sky') S.view.fov = A.clamp(gesture.fov * gesture.pinch / d, 12, 130);
      else setSpan(gesture.span * gesture.pinch / d);
      return;
    }
    if (pcount() !== 1) return;
    if (Math.abs(e.clientX - gesture.x0) + Math.abs(e.clientY - gesture.y0) > 7) gesture.moved = true;
    if (!gesture.moved) return;
    if (S.mode === 'cosmos') {
      Cosmos.view.yaw += dx * 0.006; Cosmos.view.pitch = A.clamp(Cosmos.view.pitch + dy * 0.005, 0.12, 1.5);
      gesture.vy = (gesture.vy || 0) * 0.5 + dx * 0.006 / dtm * 0.5; gesture.vp = (gesture.vp || 0) * 0.5 + dy * 0.005 / dtm * 0.5; gesture.tm = e.timeStamp;
    } else if (S.sensor) {
      S.azOffset = A.norm180(S.azOffset + dx * Sky.degPerPx());      // calibración de brújula
    } else {
      var s = Sky.degPerPx(), daz = -dx * s / Math.max(0.25, Math.cos(S.view.alt * RAD)), dal = dy * s;
      S.view.az = A.norm360(S.view.az + daz);
      S.view.alt = A.clamp(S.view.alt + dal, -8, 90);
      gesture.va = (gesture.va || 0) * 0.5 + daz / dtm * 0.5; gesture.vh = (gesture.vh || 0) * 0.5 + dal / dtm * 0.5; gesture.tm = e.timeStamp;
    }
  });
  function endPtr(e) {
    var had = ptrs[e.pointerId]; delete ptrs[e.pointerId];
    if (!had || !gesture) return;
    if (pcount() === 0) {
      if (!gesture.moved && Date.now() - gesture.t0 < 450) {
        var tn = Date.now(), dbl = lastTap && tn - lastTap.t < 330 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
        if (dbl) { lastTap = null; doubleTap(e.clientX, e.clientY); }
        else { lastTap = { t: tn, x: e.clientX, y: e.clientY }; tap(e.clientX, e.clientY); }
      } else if (!REDUCE && gesture.tm && e.timeStamp - gesture.tm < 90) {
        // Soltar en movimiento: el cielo sigue girando y se frena solo
        if (S.mode === 'cosmos') { spin.yaw = A.clamp(gesture.vy || 0, -6, 6); spin.pitch = A.clamp(gesture.vp || 0, -4, 4); }
        else if (!S.sensor && Math.abs(gesture.va || 0) + Math.abs(gesture.vh || 0) > 4) glide = { az: A.clamp(gesture.va, -400, 400), alt: A.clamp(gesture.vh, -300, 300) };
      }
      if (S.sensor) store.save();
      gesture = null;
    } else if (pcount() === 1) { gesture = { x0: 0, y0: 0, t0: 0, moved: true }; }
  }
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = Math.exp(e.deltaY * 0.0012);
    if (S.mode === 'sky') { anim = null; zoomGoal = A.clamp((zoomGoal || S.view.fov) * f, 12, 130); zoomAt = S.sensor ? null : { x: e.clientX, y: e.clientY }; }
    else setSpan(Cosmos.view.goal * f);
  }, { passive: false });
  function setSpan(v) { Cosmos.view.goal = A.clamp(v, 1.2, 2.2e7 * A.LY_AU); refreshStops(); }

  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* opcional */ } }
  function tap(x, y) {
    if (S.mode === 'cosmos') { var o = Cosmos.pick(x, y); ripples.push({ x: x, y: y, t: performance.now(), hit: !!o }); if (o) { buzz(); openCosmosCard(o); } return; }
    var hit = Sky.pick(x, y, 12);
    ripples.push({ x: x, y: y, t: performance.now(), hit: !!hit });
    if (hit) { buzz(); select(hit, false); } else if (S.sel) { S.sel = null; closeSheet(); }
  }
  // Doble toque: acerca hacia ese punto; si ya está muy cerca, vuelve a la vista amplia
  function doubleTap(x, y) {
    if (S.mode === 'cosmos') { setSpan(Cosmos.view.goal * 0.3); return; }
    if (S.sensor) return;
    var h = A.azAltFromEnu(Sky.unproject(x, y)), f = goalFov(), near = f <= 26;
    startAnim(near ? S.view.az : h.az, near ? S.view.alt : A.clamp(h.alt, -5, 89), near ? 95 : Math.max(14, f * 0.45), 0, 650);
  }
  function drawRipples(now) {
    for (var i = ripples.length - 1; i >= 0; i--) {
      var r = ripples[i], k = (now - r.t) / (r.hit ? 620 : 420);
      if (k >= 1 || REDUCE) { ripples.splice(i, 1); continue; }
      var e = 1 - Math.pow(1 - k, 3);
      ctx.strokeStyle = r.hit ? 'rgba(255,200,97,' + (0.8 * (1 - k)) + ')' : 'rgba(160,230,215,' + (0.45 * (1 - k)) + ')';
      ctx.lineWidth = r.hit ? 2 : 1.2;
      ctx.beginPath(); ctx.arc(r.x, r.y, 6 + e * (r.hit ? 46 : 26), 0, 6.2832); ctx.stroke();
    }
  }

  /* ---------- Selección y vuelo ---------- */
  function select(sel, fly) {
    S.sel = sel; openCard(sel);
    if (fly) flyTo(sel);
  }
  function flyTo(sel) {
    var v = Sky.dirOf(sel); if (!v) return;
    if (S.sensor) return;                       // con sensores, la flecha guía al usuario
    var h = A.azAltFromEnu(v), sep = A.angSep(v, S.cam.F);
    // Vuelo: la vista se abre a mitad de camino y vuelve a cerrarse sobre el objeto
    startAnim(h.az, A.clamp(h.alt, -5, 89), goalFov(), Math.min(30, sep * 0.3), A.clamp(520 + sep * 7, 520, 1100));
  }
  function goalFov() { return anim ? anim.fov1 : (zoomGoal !== null ? zoomGoal : S.view.fov); }
  function startAnim(az, alt, fov, bump, dur, easeOut) {
    glide = null; zoomGoal = null;
    anim = { az0: S.view.az, alt0: S.view.alt, fov0: S.view.fov, az1: az, alt1: alt, fov1: fov, bump: REDUCE ? 0 : bump,
      t0: performance.now(), dur: REDUCE ? 1 : dur, out: !!easeOut };
  }
  function stepAnim(now) {
    if (!anim) return;
    var k = A.clamp((now - anim.t0) / anim.dur, 0, 1);
    var e = anim.out ? 1 - Math.pow(1 - k, 3) : (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    S.view.az = A.norm360(anim.az0 + A.norm180(anim.az1 - anim.az0) * e);
    S.view.alt = anim.alt0 + (anim.alt1 - anim.alt0) * e;
    S.view.fov = A.clamp(anim.fov0 + (anim.fov1 - anim.fov0) * e + anim.bump * Math.sin(Math.PI * k), 12, 130);
    if (k >= 1) anim = null;
  }
  // Inercia del arrastre y zoom suave (anclado al punto bajo el cursor)
  function stepMotion(dt) {
    if (zoomGoal !== null) {
      var f1 = S.view.fov + (zoomGoal - S.view.fov) * (REDUCE ? 1 : Math.min(1, dt * 11));
      if (Math.abs(zoomGoal - f1) < 0.05) { f1 = zoomGoal; zoomGoal = null; }
      if (zoomAt && !S.sensor) {
        var d0 = A.azAltFromEnu(Sky.unproject(zoomAt.x, zoomAt.y));
        S.view.fov = f1; camFromView(); Sky.setCamera(S);
        var d1 = A.azAltFromEnu(Sky.unproject(zoomAt.x, zoomAt.y));
        if (d0.alt < 82 && d1.alt < 82) S.view.az = A.norm360(S.view.az + A.norm180(d0.az - d1.az));
        S.view.alt = A.clamp(S.view.alt + d0.alt - d1.alt, -8, 90);
      } else S.view.fov = f1;
    }
    if (glide) {
      S.view.az = A.norm360(S.view.az + glide.az * dt);
      S.view.alt = A.clamp(S.view.alt + glide.alt * dt, -8, 90);
      var kk = Math.exp(-dt * 3.4); glide.az *= kk; glide.alt *= kk;
      if (Math.abs(glide.az) + Math.abs(glide.alt) < 0.6) glide = null;
    }
  }
  function stepSpin(dt) {
    if (gesture) return;
    var v = Cosmos.view;
    v.yaw += spin.yaw * dt; v.pitch = A.clamp(v.pitch + spin.pitch * dt, 0.12, 1.5);
    // Sin tocar nada, la escena gira muy despacio
    var idle = REDUCE || sheetKind ? 0 : 0.022;
    spin.yaw += (idle - spin.yaw) * Math.min(1, dt * 1.6); spin.pitch *= Math.exp(-dt * 4);
  }
  // Entrada: la cámara baja desde más arriba mientras se encienden las estrellas
  function intro() {
    if (REDUCE || S.sensor) return;
    var az = S.view.az, alt = S.view.alt, fov = S.view.fov;
    Sky.intro(performance.now());
    S.view.alt = Math.min(88, alt + 20); S.view.fov = Math.min(130, fov * 1.32);
    startAnim(az, alt, fov, 0, 1900, true);
  }

  /* ---------- Hojas (paneles) ---------- */
  var sheetKind = null;
  function openSheet(kind, title, html, tall) {
    var fresh = kind !== sheetKind || kind === 'card', body = $('sheet-body');
    body.classList.remove('fresh');
    if (fresh) { void body.offsetWidth; body.classList.add('fresh'); }
    sheetKind = kind;
    $('sheet-title').textContent = title; $('sheet-body').innerHTML = html;
    $('sheet-body').scrollTop = 0;
    var sh = $('sheet'); sh.classList.toggle('tall', !!tall); sh.classList.add('open');
    document.body.classList.add('sheet-open');
  }
  function closeSheet() { sheetKind = null; $('sheet').classList.remove('open'); document.body.classList.remove('sheet-open'); }
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 3200);
  }

  /* ---------- Eventos del cielo para un objeto ---------- */
  function riseSet(altFn, h0) {
    var j = jd(), c = A.crossings(altFn, j, 1, h0, 8), tr = A.transit(altFn, j, 1);
    var up = altFn(j) > h0, out = { up: up, transit: tr };
    if (!c.length) { out.always = up; out.never = !up; return out; }
    c.forEach(function (x) { if (x.rising && !out.rise) out.rise = x.jd; if (!x.rising && !out.set) out.set = x.jd; });
    return out;
  }
  function riseSetHtml(rs) {
    if (rs.always) return row(T('rises') + ' / ' + T('sets'), T('always'));
    if (rs.never) return row(T('rises') + ' / ' + T('sets'), T('never'));
    var h = '';
    if (rs.rise) h += row(T('rises'), hhmm(A.msFromJd(rs.rise)));
    if (rs.transit && rs.transit.alt > 0) h += row(T('transit'), hhmm(A.msFromJd(rs.transit.jd)) + ' · ' + Math.round(rs.transit.alt) + '°');
    if (rs.set) h += row(T('sets'), hhmm(A.msFromJd(rs.set)));
    return h;
  }
  function row(k, v) { return '<div class="row"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; }
  function block(title, text, cls) { return text ? '<div class="blk ' + (cls || '') + '"><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p></div>' : ''; }
  function nowLine(v) {
    var h = A.azAltFromEnu(v);
    return h.alt > 0 ? fmt(T('aboveNow'), Math.round(h.alt), T('dirs')[dir8(h.az)]) : T('belowNow');
  }
  function lightAgo(ly) {
    if (!isFinite(ly) || ly <= 0) return '';
    var pt = parts(S.t), yr = pt.y + (pt.m - 0.5) / 12 - ly;
    if (ly < 1500 && yr > 0) return fmt(T('lightLeftYear'), Math.round(yr));
    return fmt(T('lightLeft'), Math.round(ly).toLocaleString(S.lang === 'es' ? 'es-CL' : 'en-US'));
  }
  function lightTime(au) {
    var s = au * 499.004784;
    if (s < 90) return fmt(T('lightSec'), Math.round(s));
    if (s < 5400) return fmt(T('lightMin'), num(s / 60, 1));
    return fmt(T('lightHr'), Math.floor(s / 3600), Math.round((s % 3600) / 60));
  }
  function magWord(m) { var b = T('brightness'); return b[m < 0 ? 0 : m < 1.5 ? 1 : m < 3 ? 2 : m < 4.6 ? 3 : 4]; }
  function parseLy(s) { var n = parseFloat(String(s).replace(/[≈.\s]/g, '').replace(',', '.')); return /mill/.test(s) ? n * 1e6 : n; }
  function tags(type, tool) {
    return '<div class="tags"><span class="tag">' + esc(type) + '</span>' + (tool ? '<span class="tag tool">' + esc(T(tool)) + '</span>' : '') + '</div>';
  }
  function coordsHtml(raDeg, dec, v) {
    var h = A.azAltFromEnu(v), ra = raDeg / 15, rh = Math.floor(ra), rm = Math.floor((ra - rh) * 60);
    var d = Math.abs(dec), dd = Math.floor(d), dm = Math.floor((d - dd) * 60);
    return '<details><summary>' + esc(T('coords')) + '</summary>' +
      row(T('ra'), rh + 'h ' + p2(rm) + 'm') + row(T('dec'), (dec < 0 ? '−' : '+') + dd + '° ' + p2(dm) + '′') +
      row(T('az'), num(h.az, 1) + '°') + row(T('alt'), num(h.alt, 1) + '°') + '</details>';
  }
  function actions(sel, cosmos) {
    return '<div class="acts"><button class="btn gold" data-act="goto">' + esc(T('goto')) + '</button>' +
      (cosmos ? '<button class="btn" data-act="cosmos" data-id="' + cosmos + '">' + esc(T('seeCosmos')) + '</button>' : '') + '</div>';
  }

  /* ---------- Ficha de objeto ---------- */
  var specialByIdx = {};
  Object.keys(CATALOG.special).forEach(function (k) { specialByIdx[CATALOG.special[k]] = k; });
  function conNameOf(abbr) { var c = CATALOG.cons[abbr]; return c ? c[S.lang === 'es' ? 1 : 0] : ''; }

  function openCard(sel) {
    var L = S.lang, v = Sky.dirOf(sel), html = '', title = '';
    if (sel.kind === 'body') {
      var b = Sky.bodies[sel.id], c = CONTENT.bodies[sel.id];
      title = c.name[L];
      html += tags(T(c.kind === 'sun' ? 'sunT' : c.kind === 'moon' ? 'moonT' : 'planet'), c.tool);
      html += '<p class="now">' + esc(nowLine(v)) + '</p><p class="lead">' + esc(c.d[L]) + '</p>';
      if (c.warn) html += '<p class="warn">' + esc(c.warn[L]) + '</p>';
      html += '<div class="grid">';
      if (sel.id === 'moon') {
        html += row(T('phase'), T('phases')[Math.round(b.phaseAngle / 45) % 8]) + row(T('illum'), Math.round(b.illum * 100) + ' %') +
          row(T('age'), num(b.age, 1) + ' ' + T('days')) + row(T('dist'), Math.round(b.distKm).toLocaleString(L === 'es' ? 'es-CL' : 'en-US') + ' km');
      } else {
        html += row(T('dist'), num(b.dist, 2) + (L === 'es' ? ' UA' : ' AU')) + row(T('lightTime'), lightTime(b.dist));
        if (sel.id !== 'sun') {
          html += row(T('mag'), num(b.mag, 1) + ' · ' + magWord(b.mag));
          if (sel.id === 'mercury' || sel.id === 'venus' || sel.id === 'mars') html += row(T('illum'), Math.round(b.illum * 100) + ' %');
          var f = c.facts;
          html += row(T('year2'), f.year[L]) + row(T('moons'), typeof f.moons === 'string' ? f.moons : f.moons[L]) + row(T('diam'), f.diam);
        }
      }
      html += riseSetHtml(riseSet(A.altOf(sel.id, S.site), sel.id === 'sun' || sel.id === 'moon' ? A.H0.sun : A.H0.star)) + '</div>';
      html += block(T('howFind'), c.find && c.find[L]) + block(T('didYouKnow'), c.f[L], 'fact') + block(T('culture'), c.cult && c.cult[L], 'cult');
      html += coordsHtml(b.ra, b.dec, v) + actions(sel, sel.id === 'moon' ? '' : sel.id);
    } else if (sel.kind === 'star') {
      var i = sel.id, n = CATALOG.names[i] || ['', '', ''], key = specialByIdx[i], sc = key && CONTENT.stars[key];
      var mag = Sky.smag[i], abbr = (n[2] || '').split(' ')[1] || '';
      title = Sky.starName(i, L) || (L === 'es' ? 'Estrella sin nombre' : 'Unnamed star');
      html += tags(T('star'), mag < 5.2 ? 'eye' : 'bino');
      if (n[2] && n[2] !== title) html += '<p class="sub">' + esc(n[2]) + (abbr ? ' · ' + esc(conNameOf(abbr)) : '') + '</p>';
      html += '<p class="now">' + esc(nowLine(v)) + '</p>';
      html += '<p class="lead">' + esc(sc ? sc.d[L] : (abbr ? fmt(T('starGeneric'), conNameOf(abbr)) : T('starGenericNoCon'))) + '</p>';
      html += '<div class="grid">';
      if (sc) html += row(T('dist'), sc.dist + ' ' + T('lightYears'));
      html += row(T('mag'), num(mag, 1) + ' · ' + magWord(mag)) + row(T('color'), T('colors')[Sky.scol[i]]);
      var ra = CATALOG.stars[i * 4] / 1000, dec = CATALOG.stars[i * 4 + 1] / 1000;
      html += riseSetHtml(riseSet(A.altOfFixed(A.vecFromRaDec(ra, dec), S.site), A.H0.star)) + '</div>';
      if (sc) {
        html += '<p class="light">' + esc(lightAgo(parseLy(sc.dist))) + '</p>';
        html += block(T('howFind'), sc.find && sc.find[L]) + block(T('didYouKnow'), sc.f[L], 'fact') + block(T('culture'), sc.cult && sc.cult[L], 'cult');
      }
      html += coordsHtml(ra, dec, v) + actions(sel);
    } else if (sel.kind === 'dso') {
      var d = Sky.dsos[sel.id].d;
      title = d.name[L];
      html += tags(T(d.type), d.tool) + '<p class="sub">' + esc(d.cat) + '</p>';
      html += '<p class="now">' + esc(nowLine(v)) + '</p><p class="lead">' + esc(d.d[L]) + '</p><div class="grid">';
      html += row(T('dist'), d.dist + ' ' + T('lightYears'));
      if (d.mag < 20 && d.type !== 'dark') html += row(T('mag'), num(d.mag, 1) + ' · ' + magWord(d.mag));
      html += riseSetHtml(riseSet(A.altOfFixed(A.vecFromRaDec(d.ra, d.dec), S.site), A.H0.star)) + '</div>';
      html += '<p class="light">' + esc(lightAgo(parseLy(d.dist))) + '</p>';
      html += block(T('howFind'), d.find && d.find[L]) + block(T('didYouKnow'), d.f[L], 'fact') + block(T('culture'), d.cult && d.cult[L], 'cult');
      html += coordsHtml(d.ra, d.dec, v) + actions(sel);
    } else if (sel.kind === 'con') {
      var cl = Sky.conLabels[sel.id];
      title = cl[L];
      html += tags(T('constellation')) + '<p class="sub">' + esc(cl.id) + '</p><p class="now">' + esc(nowLine(v)) + '</p><p class="lead">' + esc(T('conGeneric')) + '</p>' + actions(sel);
    }
    openSheet('card', title, html);
  }

  function openCosmosCard(o) {
    var L = S.lang, html = '', ly = o.dist / A.LY_AU;
    var type = { planet: T('planet'), star: T('star'), galaxy: T('galaxy'), gc: T('center'), probe: T('probe') }[o.kind];
    if (o.id === 'pluto') type = T('dwarf');
    html += tags(type) + '<div class="grid">' + row(T(o.kind === 'planet' ? 'fromSun' : 'dist'), Cosmos.fmtDist(o.dist, L));
    if (ly < 0.5) html += row(T('lightTime'), lightTime(o.dist));
    html += '</div>';
    if (ly >= 0.5) html += '<p class="light">' + esc(lightAgo(ly)) + '</p>';
    var c = o.id && CONTENT.bodies[o.id];
    if (c) html += '<p class="lead">' + esc(c.d[L]) + '</p>' + block(T('didYouKnow'), c.f[L], 'fact') +
      '<div class="acts"><button class="btn gold" data-act="sky" data-id="' + o.id + '">' + esc(T('seeSky')) + '</button></div>';
    if (o.kind === 'probe') html += '<p class="lead">' + esc(L === 'es'
      ? 'Lanzada en 1977 y todavía en contacto con la Tierra. Su posición aquí es aproximada. Según las proyecciones de la NASA, Voyager 1 alcanza la distancia de un día-luz hacia noviembre de 2026.'
      : 'Launched in 1977 and still in contact with Earth. Its position here is approximate. According to NASA projections, Voyager 1 reaches a distance of one light-day around November 2026.') + '</p>';
    openSheet('card', o.name, html);
  }

  /* ---------- «Esta noche» ---------- */
  function nightInfo() {
    var alt = A.altOf('sun', S.site), j = jd(), sunUp = alt(j) > A.H0.sun;
    var from = sunUp ? j : j - 0.75;
    var c = A.crossings(alt, from, 1.6, A.H0.sun, 8), set, rise, i;
    for (i = 0; i < c.length; i++) {
      if (!c[i].rising) { if (sunUp ? !set : c[i].jd <= j) set = c[i].jd; }
    }
    if (!set) return { set: null };
    for (i = 0; i < c.length; i++) if (c[i].rising && c[i].jd > set) { rise = c[i].jd; break; }
    var a = A.crossings(alt, set, rise ? rise - set : 0.9, A.H0.astro, 6), dusk, dawn;
    a.forEach(function (x) { if (!x.rising && !dusk) dusk = x.jd; if (x.rising && dusk) dawn = x.jd; });
    return { set: set, rise: rise, dusk: dusk, dawn: dawn };
  }
  function duskTime() {
    var alt = A.altOf('sun', S.site), j = jd();
    if (alt(j) < -12) return null;
    var c = A.crossings(alt, j, 1.1, A.H0.nautical, 6).filter(function (x) { return !x.rising; });
    return c.length ? A.msFromJd(c[0].jd) : null;
  }
  function searchIndex() {
    var L = S.lang, out = [];
    Object.keys(CONTENT.bodies).forEach(function (id) { out.push({ n: CONTENT.bodies[id].name[L], sel: { kind: 'body', id: id }, k: 0 }); });
    Sky.dsos.forEach(function (o, i) { out.push({ n: o.d.name[L], alt: o.d.cat, sel: { kind: 'dso', id: i }, k: 1 }); });
    Object.keys(CATALOG.names).forEach(function (i) {
      var n = CATALOG.names[i], nm = Sky.starName(+i, L);
      if (n[0]) out.push({ n: nm, alt: n[0] + ' ' + n[2], sel: { kind: 'star', id: +i }, k: 2 });
    });
    Sky.conLabels.forEach(function (c, i) { out.push({ n: c[L], alt: c.en + ' ' + c.id, sel: { kind: 'con', id: i }, k: 3 }); });
    return out;
  }
  function plain(s) { return (s || '').toLowerCase().normalize ? (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : (s || '').toLowerCase(); }
  function item(sel, name, sub, right, cls) {
    return '<button class="item ' + (cls || '') + '" data-act="pick" data-kind="' + sel.kind + '" data-id="' + sel.id + '"><span class="dot k-' + sel.kind + '"></span>' +
      '<span class="nm">' + esc(name) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="rt">' + esc(right || '') + '</span></button>';
  }
  function where(v) { var h = A.azAltFromEnu(v); return h.alt > 0 ? Math.round(h.alt) + '° ' + T('dirsShort')[dir8(h.az)] : T('below'); }

  function openTonight() {
    Sky.update(S);
    var L = S.lang, n = nightInfo(), m = Sky.bodies.moon, html = '';
    html += '<input id="search" class="search" type="search" placeholder="' + esc(T('search')) + '" autocomplete="off"><div id="results"></div><div id="tonight">';
    html += '<div class="grid">';
    if (n.set) html += row(T('sunset'), hhmm(A.msFromJd(n.set)));
    if (n.dusk) html += row(T('darkFrom'), hhmm(A.msFromJd(n.dusk)));
    else if (n.set) html += row(T('darkFrom'), T('noDark'));
    if (n.dawn) html += row(T('darkUntil'), hhmm(A.msFromJd(n.dawn)));
    if (n.rise) html += row(T('sunrise'), hhmm(A.msFromJd(n.rise)));
    html += row(T('moon'), T('phases')[Math.round(m.phaseAngle / 45) % 8] + ' · ' + Math.round(m.illum * 100) + ' %') + '</div>';
    if (duskTime()) html += '<div class="acts"><button class="btn" data-act="dusk">' + esc(T('dusk')) + '</button></div>';

    html += '<h3>' + esc(T('planets')) + '</h3>';
    ['moon', 'venus', 'jupiter', 'saturn', 'mars', 'mercury', 'sun', 'uranus', 'neptune'].forEach(function (id) {
      var b = Sky.bodies[id], v = Sky.dirOf({ kind: 'body', id: id }), sub = '';
      if (b.alt <= 0) {
        var c = A.crossings(A.altOf(id, S.site), jd(), 1, A.H0.star, 10).filter(function (x) { return x.rising; });
        if (c.length) sub = T('rises') + ' ' + hhmm(A.msFromJd(c[0].jd));
      } else if (id !== 'sun' && id !== 'moon') sub = T(CONTENT.bodies[id].tool);
      html += item({ kind: 'body', id: id }, CONTENT.bodies[id].name[L], sub, where(v), b.alt <= 0 ? 'off' : '');
    });
    var up = [];
    Sky.dsos.forEach(function (o, i) {
      var h = A.azAltFromEnu(Sky.dirOf({ kind: 'dso', id: i }));
      if (h.alt > 12 && o.d.prio >= 5) up.push({ sel: { kind: 'dso', id: i }, name: o.d.name[L], sub: T(o.d.tool), h: h, score: o.d.prio * 10 + h.alt * 0.3 });
    });
    Object.keys(CONTENT.stars).forEach(function (k) {
      var i = CATALOG.special[k], h = A.azAltFromEnu(Sky.dirOf({ kind: 'star', id: i }));
      if (h.alt > 12) up.push({ sel: { kind: 'star', id: i }, name: Sky.starName(i, L), sub: T('star'), h: h, score: 62 - Sky.smag[i] * 12 + h.alt * 0.3 });
    });
    up.sort(function (a, b) { return b.score - a.score; });
    html += '<h3>' + esc(T('nowUp')) + '</h3>';
    up.slice(0, 16).forEach(function (u) { html += item(u.sel, u.name, u.sub, Math.round(u.h.alt) + '° ' + T('dirsShort')[dir8(u.h.az)]); });
    html += '</div>';
    openSheet('tonight', T('tonight') + ' · ' + S.site.name, html, true);
    var idx = searchIndex(), box = $('search');
    box.addEventListener('input', function () {
      var q = plain(box.value.trim()), res = $('results'), list = $('tonight');
      if (q.length < 2) { res.innerHTML = ''; list.style.display = ''; return; }
      var hits = idx.filter(function (o) { return plain(o.n).indexOf(q) >= 0 || plain(o.alt).indexOf(q) >= 0; })
        .sort(function (a, b) { return (plain(a.n).indexOf(q) === 0 ? 0 : 1) - (plain(b.n).indexOf(q) === 0 ? 0 : 1) || a.k - b.k; }).slice(0, 30);
      list.style.display = 'none';
      res.innerHTML = hits.length ? hits.map(function (o) {
        return item(o.sel, o.n, o.k === 1 ? o.alt : o.k === 2 ? T('star') : o.k === 3 ? T('constellation') : '', where(Sky.dirOf(o.sel)));
      }).join('') : '<p class="mute">' + esc(T('noResults')) + '</p>';
    });
  }

  /* ---------- Capas, lugar, hora, ayuda ---------- */
  function openLayers() {
    var html = '', keys = [['lines', 'lyLines'], ['conNames', 'lyConNames'], ['starNames', 'lyStarNames'], ['grid', 'lyGrid'], ['mw', 'lyMw'],
      ['dso', 'lyDso'], ['pointer', 'lyPointer'], ['equ', 'lyEqu'], ['ground', 'lyGround'], ['atm', 'lyAtm'], ['fx', 'lyFx']];
    keys.forEach(function (k) {
      html += '<label class="sw"><span>' + esc(T(k[1])) + '</span><input type="checkbox" data-layer="' + k[0] + '"' + (S.layers[k[0]] ? ' checked' : '') + '><i></i></label>';
    });
    html += '<div class="slider"><span>' + esc(T('magLimit')) + '</span><div><small>' + esc(T('few')) + '</small><input type="range" id="r-mag" min="2.5" max="6.5" step="0.25" value="' + S.magLimit + '"><small>' + esc(T('many')) + '</small></div></div>';
    html += '<div class="slider"><span>' + esc(T('camFov')) + ' · <b id="v-fov">' + S.camFov + '°</b></span><div><input type="range" id="r-fov" min="40" max="90" step="1" value="' + S.camFov + '"></div></div>';
    html += '<div class="slider"><span>' + esc(T('compassFix')) + ' · <b id="v-off">' + Math.round(S.azOffset) + '°</b></span><div><input type="range" id="r-off" min="-180" max="180" step="1" value="' + Math.round(S.azOffset) + '"></div></div>';
    openSheet('layers', T('layers'), html);
  }
  function openPlace() {
    var L = S.lang, html = '<button class="btn wide" data-act="gps">' + esc(T('useGps')) + '</button>';
    CONTENT.sites.forEach(function (s, i) {
      var on = Math.abs(s.lat - S.site.lat) < 1e-4 && Math.abs(s.lon - S.site.lon) < 1e-4;
      html += '<button class="item' + (on ? ' on' : '') + '" data-act="site" data-id="' + i + '"><span class="dot k-site"></span><span class="nm">' + esc(s.name) + '<small>' + esc(s.note[L]) + '</small></span><span class="rt">' +
        num(Math.abs(s.lat), 2) + '° S</span></button>';
    });
    html += '<h3>' + esc(T('custom')) + '</h3><div class="two"><label>' + esc(T('lat')) + '<input id="i-lat" type="number" step="0.0001" min="-90" max="90" value="' + S.site.lat + '"></label>' +
      '<label>' + esc(T('lon')) + '<input id="i-lon" type="number" step="0.0001" min="-180" max="180" value="' + S.site.lon + '"></label></div>' +
      '<button class="btn wide" data-act="coords">' + esc(T('apply')) + '</button>';
    openSheet('place', T('place'), html, true);
  }
  var RATES = [0, 1, 60, 600, 3600, 86400, 2592000, 31557600];
  function rateLabel(r) {
    if (r === 0) return T('pause'); if (r === 1) return T('realtime');
    if (r < 3600) return (r / 60) + ' ' + T('min') + T('perSec');
    if (r < 86400) return (r / 3600) + ' ' + T('hour') + T('perSec');
    if (r < 2e6) return '1 ' + T('day') + T('perSec');
    if (r < 3e7) return '30 ' + T('days') + T('perSec');
    return '1 ' + T('year') + T('perSec');
  }
  function openTime() {
    var p = parts(S.t), html = '';
    html += '<div class="acts"><button class="btn gold" data-act="now">' + esc(T('now')) + '</button>' + (duskTime() ? '<button class="btn" data-act="dusk">' + esc(T('dusk')) + '</button>' : '') + '</div>';
    html += '<input id="i-dt" class="dt" type="datetime-local" value="' + p.y + '-' + p2(p.m) + '-' + p2(p.d) + 'T' + p2(p.H) + ':' + p2(p.M) + '">';
    html += '<div class="steps">' + [['-1d', -86400], ['-1h', -3600], ['+1h', 3600], ['+1d', 86400]].map(function (s) {
      return '<button class="btn" data-act="shift" data-id="' + s[1] + '">' + s[0].replace('d', ' ' + T('day')).replace('h', ' ' + T('hour')) + '</button>';
    }).join('') + '</div>';
    html += '<h3>' + esc(T('speed')) + '</h3><div class="rates">' + RATES.map(function (r) {
      return '<button class="btn' + (S.rate === r ? ' on' : '') + '" data-act="rate" data-id="' + r + '">' + esc(rateLabel(r)) + '</button>';
    }).join('') + '</div>';
    openSheet('time', T('time'), html);
  }
  function openHelp() {
    var html = '';
    T('helpBody').forEach(function (h) { html += '<div class="blk"><h4>' + esc(h[0]) + '</h4><p>' + esc(h[1]) + '</p></div>'; });
    html += '<p class="mute">' + esc(T('precision')) + '<br>' + esc(T('about')) + '</p>';
    openSheet('help', T('help'), html, true);
  }
  function setTime(ms, live) { S.t = ms; S.live = !!live; if (live) S.rate = 1; refreshChips(true); }
  function setSite(name, lat, lon) {
    S.site = { name: name, lat: A.clamp(lat, -89.9, 89.9), lon: A.norm180(lon) };
    store.save(); refreshChips(true); banner.dismissed = false;
  }

  /* ---------- «¿Qué estoy mirando?» ---------- */
  function identify() {
    if (S.sensor && S.sel && Sky.guide) { toast(fmt(T('guide'), Sky.guide)); }
    var hit = Sky.pick(W / 2, H / 2, Math.min(W, H) * 0.09);
    if (hit) { select(hit, false); return; }
    var F = S.cam.F, h = A.azAltFromEnu(F), con = Sky.nearestConstellation(F), best = null, bd = 999, L = S.lang;
    function consider(sel, name) { var v = Sky.dirOf(sel); if (!v || v[2] < 0.05) return; var d = A.angSep(v, F); if (d < bd) { bd = d; best = { sel: sel, name: name }; } }
    Object.keys(CONTENT.bodies).forEach(function (id) { if (id !== 'uranus' && id !== 'neptune') consider({ kind: 'body', id: id }, CONTENT.bodies[id].name[L]); });
    Sky.dsos.forEach(function (o, i) { if (o.d.prio >= 7) consider({ kind: 'dso', id: i }, o.d.name[L]); });
    for (var i = 0; i < Sky.N && Sky.smag[i] < 1.6; i++) consider({ kind: 'star', id: i }, Sky.starName(i, L));
    var html = '<p class="lead">' + esc(fmt(T('nothingBody'), T('dirs')[dir8(h.az)], Math.round(Math.max(0, h.alt)), con ? con[L] : '—')) + '</p>';
    if (best) {
      html += '<p class="lead">' + esc(fmt(T('nearest'), best.name, Math.round(bd))) + '</p>' +
        '<div class="acts"><button class="btn gold" data-act="pick" data-fly="1" data-kind="' + best.sel.kind + '" data-id="' + best.sel.id + '">' + esc(T('goto')) + ' → ' + esc(best.name) + '</button></div>';
    }
    html += '<p class="mute">' + esc(T('tryTap')) + '</p>';
    openSheet('none', T('nothing'), html);
  }

  /* ---------- Controles fijos ---------- */
  var ICON = {
    compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M19 14.5A8 8 0 019.5 5a8 8 0 109.5 9.5z"/></svg>',
    scope: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.4 5.8.5-4.4 3.8 1.4 5.7-5-3.1-5 3.1 1.4-5.7L4 8.9l5.8-.5z"/></svg>',
    layers: '<svg viewBox="0 0 24 24"><path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5a7 7 0 10-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>'
  };
  function refreshRail() {
    $('b-sensor').classList.toggle('on', S.sensor); $('b-cam').classList.toggle('on', S.camera);
    $('b-cam').style.display = S.sensor ? '' : 'none';
    document.body.classList.toggle('sensing', S.sensor);
  }
  var chipState = '';
  function refreshChips(force) {
    var st = S.rate === 0 ? T('paused') : (S.live ? T('live') : (S.rate === 1 ? T('sim') : '× ' + rateLabel(S.rate)));
    var key = S.site.name + '|' + Math.floor(S.t / 60000) + '|' + st + '|' + S.lang;
    if (!force && key === chipState) return; chipState = key;
    $('c-place').innerHTML = ICON.pin + '<span>' + esc(S.site.name) + '</span>';
    $('c-time').innerHTML = ICON.clock + '<span>' + esc(dateLabel(S.t)) + ' · <b>' + hhmm(S.t) + '</b></span><em class="' + (S.live && S.rate === 1 ? 'live' : '') + '">' + esc(st) + '</em>';
  }
  function refreshStops() {
    var cur = Cosmos.stopFor(Cosmos.view.goal);
    Array.prototype.forEach.call($('stops').children, function (b, i) { b.classList.toggle('on', i === cur); });
  }
  function applyLang() {
    document.documentElement.lang = S.lang;
    $('b-lang').textContent = S.lang === 'es' ? 'EN' : 'ES';
    $('m-sky').textContent = T('sky'); $('m-cosmos').textContent = T('cosmos');
    $('b-what').querySelector('span').textContent = T('what');
    $('b-tonight').querySelector('span').textContent = T('tonight');
    $('b-layers').querySelector('span').textContent = T('layers');
    [['b-sensor', 'sensor'], ['b-cam', 'camera'], ['b-in', 'zoomIn'], ['b-out', 'zoomOut'], ['b-red', 'night'], ['b-help', 'help'], ['sheet-close', 'close']].forEach(function (p) {
      $(p[0]).setAttribute('aria-label', T(p[1])); $(p[0]).title = T(p[1]);
    });
    $('stops').innerHTML = Cosmos.STOPS.map(function (s, i) { return '<button data-act="stop" data-id="' + i + '">' + esc(T('stops')[s.id]) + '</button>'; }).join('');
    refreshStops(); refreshChips(true); heading.key = '';
    if (sheetKind === 'card' && S.sel && S.mode === 'sky') openCard(S.sel); else if (sheetKind) closeSheet();
  }
  function setMode(m) {
    var changed = m !== S.mode;
    S.mode = m; if (m === 'cosmos' && S.sensor) stopSensor();
    if (changed) {
      Sky.hover = null; glide = null; cv.style.cursor = '';
      cv.classList.remove('swap'); void cv.offsetWidth; cv.classList.add('swap');
      if (!REDUCE) {
        if (m === 'cosmos') { Cosmos.view.span = Cosmos.view.goal * 2.6; spin.yaw = 0.5; }
        else { var f0 = goalFov(); S.view.fov = Math.min(130, f0 * 1.18); startAnim(S.view.az, S.view.alt, f0, 0, 700, true); }
      }
    }
    document.body.classList.toggle('cosmos', m === 'cosmos');
    $('m-sky').classList.toggle('on', m === 'sky'); $('m-cosmos').classList.toggle('on', m === 'cosmos');
    closeSheet(); banner.el.classList.remove('show');
    if (m === 'cosmos' && S.rate < 86400 && S.rate !== 0) { /* el reloj real basta: los planetas se mueven despacio */ }
    if (m === 'sky' && S.rate > 3600) { S.rate = 1; refreshChips(true); }
  }

  var heading = { key: '' };
  function refreshHeading() {
    var h = A.azAltFromEnu(S.cam.F), txt, key;
    if (S.mode === 'cosmos') {
      var span = Cosmos.view.span; key = 'c' + Math.round(Math.log(span) * 20) + S.lang;
      if (key === heading.key) return; heading.key = key;
      $('heading').innerHTML = '<b>' + esc(fmt(T('viewWidth'), Cosmos.fmtDist(span, S.lang))) + '</b><small>' + esc(fmt(T('lightCross'), lightSpan(span))) + '</small>';
      return;
    }
    key = dir8(h.az) + '|' + Math.round(h.alt) + S.lang;
    if (key === heading.key) return; heading.key = key;
    txt = h.alt > 84 ? T('zenith') : fmt(T('lookingAt'), T('dirsShort')[dir8(h.az)], Math.round(h.alt));
    $('heading').innerHTML = '<b>' + esc(txt) + '</b>';
  }
  function lightSpan(au) {
    var ly = au / A.LY_AU;
    if (ly >= 1) return (ly >= 100 ? Math.round(ly).toLocaleString(S.lang === 'es' ? 'es-CL' : 'en-US') : num(ly, 1)) + ' ' + T('ya');
    var s = au * 499.004784;
    if (s > 86400 * 2) return Math.round(s / 86400) + ' ' + T('days');
    return lightTime(au);
  }
  var banner = { el: $('banner'), dismissed: false };
  function refreshBanner() {
    var show = S.mode === 'sky' && !banner.dismissed && S.layers.atm && Sky.sunAlt > -4 && !sheetKind && !$('welcome').classList.contains('show');
    if (show && !banner.el.classList.contains('show')) {
      banner.el.innerHTML = '<span>' + esc(fmt(T('daytime'), S.site.name)) + '</span><button class="btn gold" data-act="dusk">' + esc(T('dusk')) + '</button><button class="x" data-act="nobanner" aria-label="' + esc(T('close')) + '">×</button>';
    }
    banner.el.classList.toggle('show', show);
  }

  /* ---------- Delegación de eventos ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null; if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (act === 'pick') {
      var kind = el.getAttribute('data-kind'), sel = { kind: kind, id: kind === 'body' ? id : +id };
      if (S.mode !== 'sky') setMode('sky');
      Sky.update(S); select(sel, true);
    } else if (act === 'goto') { if (S.sel) { flyTo(S.sel); if (W < 860) closeSheetKeepSel(); if (S.sensor) toast(fmt(T('guide'), Math.round(A.angSep(Sky.dirOf(S.sel), S.cam.F)))); } }
    else if (act === 'cosmos') { setMode('cosmos'); var ix = { mercury: 0, venus: 0, mars: 0, sun: 0 }[id] === 0 ? 0 : 1; setSpan(Cosmos.STOPS[ix].span); }
    else if (act === 'sky') { setMode('sky'); Sky.update(S); select({ kind: 'body', id: id }, true); }
    else if (act === 'dusk') { var d = duskTime(); if (d) { setTime(d + 20 * 60000, false); S.rate = 1; banner.dismissed = true; closeSheet(); } }
    else if (act === 'nobanner') { banner.dismissed = true; }
    else if (act === 'now') { setTime(Date.now(), true); openTime(); }
    else if (act === 'shift') { setTime(S.t + (+id) * 1000, false); openTime(); }
    else if (act === 'rate') { S.rate = +id; S.live = S.live && S.rate === 1; refreshChips(true); openTime(); }
    else if (act === 'site') { var s = CONTENT.sites[+id]; setSite(s.name, s.lat, s.lon); openPlace(); }
    else if (act === 'coords') { var la = parseFloat($('i-lat').value), lo = parseFloat($('i-lon').value); if (isFinite(la) && isFinite(lo)) { setSite(T('custom'), la, lo); closeSheet(); } }
    else if (act === 'gps') {
      if (!navigator.geolocation) { toast(T('gpsFail')); return; }
      navigator.geolocation.getCurrentPosition(function (p) { setSite(T('myLocation'), p.coords.latitude, p.coords.longitude); toast(T('gpsOk')); closeSheet(); },
        function () { toast(window.isSecureContext === false ? T('needHttps') : T('gpsFail'), 5000); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
    }
    else if (act === 'stop') { setSpan(Cosmos.STOPS[+id].span); }
    else if (act === 'start') { $('welcome').classList.remove('show'); store.save(true); if (id === 'sensor') startSensor(); else intro(); }
  });
  function closeSheetKeepSel() { var s = S.sel; closeSheet(); S.sel = s; }
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-layer')) { S.layers[t.getAttribute('data-layer')] = t.checked; store.save(); }
    if (t.id === 'i-dt' && t.value) { var m = t.value.match(/(\d+)-(\d+)-(\d+)T(\d+):(\d+)/); if (m) setTime(fromWall(+m[1], +m[2], +m[3], +m[4], +m[5]), false); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'r-mag') { S.magLimit = +t.value; store.save(); }
    if (t.id === 'r-fov') { S.camFov = +t.value; $('v-fov').textContent = t.value + '°'; store.save(); }
    if (t.id === 'r-off') { S.azOffset = +t.value; $('v-off').textContent = t.value + '°'; store.save(); }
  });
  $('sheet-close').addEventListener('click', function () { closeSheet(); S.sel = null; });
  (function () {
    var sh = $('sheet'), drag = null;
    function down(e) {
      if (W >= 860 || (e.target.closest && e.target.closest('button'))) return;
      drag = { y: e.clientY, t: Date.now(), d: 0 }; sh.style.transition = 'none';
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* sin captura */ }
    }
    function move(e) { if (!drag) return; drag.d = Math.max(0, e.clientY - drag.y); sh.style.transform = 'translateY(' + drag.d + 'px)'; }
    function up() {
      if (!drag) return;
      var d = drag.d, fast = d / Math.max(1, Date.now() - drag.t) > 0.5;
      sh.style.transition = ''; sh.style.transform = ''; drag = null;
      if (d > 90 || (fast && d > 24)) { closeSheet(); S.sel = null; }
    }
    [sh.querySelector('.grip'), sh.querySelector('.sheet-head')].forEach(function (el) {
      el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  })();
  $('b-what').addEventListener('click', identify);
  $('b-tonight').addEventListener('click', openTonight);
  $('b-layers').addEventListener('click', openLayers);
  $('c-place').addEventListener('click', openPlace);
  $('c-time').addEventListener('click', openTime);
  $('b-help').addEventListener('click', openHelp);
  $('b-lang').addEventListener('click', function () { S.lang = S.lang === 'es' ? 'en' : 'es'; store.save(); applyLang(); });
  $('b-red').addEventListener('click', function () { S.red = !S.red; document.body.classList.toggle('red', S.red); $('b-red').classList.toggle('on', S.red); store.save(); });
  $('b-sensor').addEventListener('click', function () { if (S.sensor) { stopSensor(); toast(T('sensorOff')); } else startSensor(); });
  $('b-cam').addEventListener('click', function () { if (S.camera) stopCamera(); else startCamera(); });
  function zoom(f) {
    if (S.mode === 'sky') { anim = null; zoomAt = null; zoomGoal = A.clamp((zoomGoal || S.view.fov) * f, 12, 130); }
    else setSpan(Cosmos.view.goal * f * f * f);
  }
  $('b-in').addEventListener('click', function () { zoom(0.8); });
  $('b-out').addEventListener('click', function () { zoom(1.25); });
  $('m-sky').addEventListener('click', function () { setMode('sky'); });
  $('m-cosmos').addEventListener('click', function () { setMode('cosmos'); });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { closeSheet(); S.sel = null; }
    if (S.mode !== 'sky' || S.sensor) return;
    var st = S.view.fov / 12;
    if (e.key.indexOf('Arrow') === 0) { anim = null; glide = null; }
    if (e.key === 'ArrowLeft') S.view.az = A.norm360(S.view.az - st);
    if (e.key === 'ArrowRight') S.view.az = A.norm360(S.view.az + st);
    if (e.key === 'ArrowUp') S.view.alt = A.clamp(S.view.alt + st, -8, 90);
    if (e.key === 'ArrowDown') S.view.alt = A.clamp(S.view.alt - st, -8, 90);
    if (e.key === '+' || e.key === '=') zoom(0.8); if (e.key === '-') zoom(1.25);
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.live) S.t = Date.now(); last = 0; });

  /* ---------- Bucle principal ---------- */
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.25, (now - last) / 1000) : 0; last = now;
    if (S.live && S.rate === 1) S.t = Date.now(); else S.t += dt * 1000 * S.rate;
    if (S.mode === 'sky') {
      if (S.sensor && sens.F) {
        S.cam.F = sens.F; S.cam.U = sens.U; S.cam.R = sens.R;
        var h = A.azAltFromEnu(sens.F); S.view.az = h.az; S.view.alt = h.alt;
      } else { stepAnim(now); stepMotion(dt); camFromView(); }
      Sky.render(ctx, W, H, S, now);
    } else {
      stepSpin(dt);
      Cosmos.render(ctx, W, H, S, dt);
    }
    if (ripples.length) drawRipples(now);
    refreshChips(false); refreshHeading(); refreshBanner();
  }

  /* ---------- Inicio ---------- */
  function welcome() {
    var touch = 'ontouchstart' in window && window.DeviceOrientationEvent && window.isSecureContext !== false;
    $('welcome').innerHTML = '<div class="card"><p class="kick">' + esc(S.site.name) + ' · 30° S</p><h1>' + esc(T('welcomeTitle')) + '</h1><p>' + esc(fmt(T('welcomeBody'), S.site.name)) + '</p>' +
      '<ul><li>' + esc(T('w1')) + '</li><li>' + esc(T('w2')) + '</li><li>' + esc(T('w3')) + '</li></ul>' +
      '<button class="btn gold wide" data-act="start">' + esc(T('start')) + '</button>' +
      (touch ? '<button class="btn wide" data-act="start" data-id="sensor">' + esc(T('startSensor')) + '</button>' : '') + '</div>';
    $('welcome').classList.add('show');
  }
  function init() {
    var seen = store.load();
    $('b-sensor').innerHTML = ICON.compass; $('b-cam').innerHTML = ICON.cam; $('b-in').innerHTML = ICON.plus; $('b-out').innerHTML = ICON.minus;
    $('b-red').innerHTML = ICON.moon;
    $('b-what').innerHTML = ICON.scope + '<span></span>'; $('b-tonight').innerHTML = ICON.list + '<span></span>'; $('b-layers').innerHTML = ICON.layers + '<span></span>';
    document.body.classList.toggle('red', S.red); $('b-red').classList.toggle('on', S.red);
    resize(); window.addEventListener('resize', resize);
    applyLang(); refreshRail(); setMode('sky');
    // Vista inicial: hacia el objeto más llamativo que esté sobre el horizonte
    camFromView(); Sky.update(S);
    var best = null, bs = -1;
    Sky.dsos.forEach(function (o, i) { var h = A.azAltFromEnu(Sky.dirOf({ kind: 'dso', id: i })); if (h.alt > 20 && h.alt < 70 && o.d.prio > bs) { bs = o.d.prio; best = h; } });
    if (best) { S.view.az = best.az; S.view.alt = A.clamp(best.alt, 25, 60); }
    if (!seen) welcome(); else intro();
    if (location.protocol === 'https:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
    requestAnimationFrame(frame);
  }
  window.__cielos = { S: S, Sky: Sky, Cosmos: Cosmos, Astro: A, select: select, identify: identify, setTime: setTime, setMode: setMode, onOrient: onOrient, openTonight: openTonight };
  init();
})();
