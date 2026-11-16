/* =====================================================================
   astro.js — Motor astronómico de Cielos de Ovalle
   Sin dependencias. Funciona igual en el navegador y en Node (tests).

   Marcos de referencia
   --------------------
   · Estrellas y planetas se calculan en ecuatorial J2000 y se llevan a
     la fecha con la matriz de precesión IAU 1976.
   · La Luna se calcula en eclíptica de la fecha (Meeus cap. 47).
   · Horizontal: vector unitario [Este, Norte, Arriba].

   Precisión esperada (validada contra PyEphem, ver tests/):
   Sol ~0.01°, Luna ~0.02°, Mercurio–Marte ~0.02°, Júpiter–Neptuno <0.2°.
   ===================================================================== */
var Astro = (function () {
  'use strict';

  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var AU_KM = 149597870.7, EARTH_R_KM = 6378.14, LY_AU = 63241.077;
  var EPS0 = 23.4392911 * RAD;            // oblicuidad J2000
  var C0 = Math.cos(EPS0), S0 = Math.sin(EPS0);

  function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function norm180(x) { x = norm360(x); return x > 180 ? x - 360 : x; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* ---------- Tiempo ---------- */
  function jdFromMs(ms) { return ms / 86400000 + 2440587.5; }
  function msFromJd(jd) { return (jd - 2440587.5) * 86400000; }
  // ΔT = TT − UT en segundos. Casi plano (~69 s) entre 2015 y 2035.
  function deltaT(jd) {
    var y = 2000 + (jd - 2451545) / 365.25;
    if (y > 2015 && y < 2035) return 69.2;
    var t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  function centuriesTT(jd) { return (jd + deltaT(jd) / 86400 - 2451545) / 36525; }
  // Tiempo sidéreo medio de Greenwich, en grados
  function gmst(jd) {
    var T = (jd - 2451545) / 36525;
    return norm360(280.46061837 + 360.98564736629 * (jd - 2451545) +
      0.000387933 * T * T - T * T * T / 38710000);
  }
  function lst(jd, lonDeg) { return norm360(gmst(jd) + lonDeg); }
  function obliquity(T) {
    return (23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T) * RAD;
  }

  /* ---------- Matrices 3×3 (arreglo de 9, por filas) ---------- */
  function mul(A, B) {
    var C = new Array(9);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return C;
  }
  function apply(M, v) {
    return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
            M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
            M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
  }
  function transpose(M) { return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]]; }

  // Precesión J2000 → fecha (IAU 1976)
  function precessionMatrix(T) {
    var as = RAD / 3600;
    var zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * as;
    var z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * as;
    var th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * as;
    var cz = Math.cos(z), sz = Math.sin(z), ct = Math.cos(th), st = Math.sin(th),
        cZ = Math.cos(zeta), sZ = Math.sin(zeta);
    return [cz * ct * cZ - sz * sZ, -cz * ct * sZ - sz * cZ, -cz * st,
            sz * ct * cZ + cz * sZ, -sz * ct * sZ + cz * cZ, -sz * st,
            st * cZ, -st * sZ, ct];
  }
  // Ecuatorial de la fecha → horizontal [E, N, U]
  function localMatrix(lstDeg, latDeg) {
    var t = lstDeg * RAD, p = latDeg * RAD;
    var ct = Math.cos(t), st = Math.sin(t), cp = Math.cos(p), sp = Math.sin(p);
    return [-st, ct, 0,
            -sp * ct, -sp * st, cp,
            cp * ct, cp * st, sp];
  }
  // Galáctico → ecuatorial J2000 (polo norte galáctico 12h51.4m +27°07.7′, nodo l=32.93°)
  var GAL = (function () {
    var a = 192.85948 * RAD, d = 27.12825 * RAD, l = 122.93192 * RAD;
    var ca = Math.cos(a), sa = Math.sin(a), cd = Math.cos(d), sd = Math.sin(d),
        cl = Math.cos(l), sl = Math.sin(l);
    // Filas = ejes ecuatoriales expresados con componentes galácticas
    return [-ca * sd * cl - sa * sl, -ca * sd * sl + sa * cl, ca * cd,
            -sa * sd * cl + ca * sl, -sa * sd * sl - ca * cl, sa * cd,
            cd * cl, cd * sl, sd];
  })();

  /* ---------- Conversiones ---------- */
  function vecFromRaDec(raDeg, decDeg) {
    var a = raDeg * RAD, d = decDeg * RAD, c = Math.cos(d);
    return [c * Math.cos(a), c * Math.sin(a), Math.sin(d)];
  }
  function raDecFromVec(v) {
    var r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return { ra: norm360(Math.atan2(v[1], v[0]) * DEG), dec: Math.asin(clamp(v[2] / r, -1, 1)) * DEG, r: r };
  }
  function azAltFromEnu(v) {
    var r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return { az: norm360(Math.atan2(v[0], v[1]) * DEG), alt: Math.asin(clamp(v[2] / r, -1, 1)) * DEG };
  }
  function enuFromAzAlt(azDeg, altDeg) {
    var a = azDeg * RAD, h = altDeg * RAD, c = Math.cos(h);
    return [c * Math.sin(a), c * Math.cos(a), Math.sin(h)];
  }
  function eclToEqu0(v) { return [v[0], v[1] * C0 - v[2] * S0, v[1] * S0 + v[2] * C0]; }
  function equ0ToEcl(v) { return [v[0], v[1] * C0 + v[2] * S0, -v[1] * S0 + v[2] * C0]; }
  function angSep(a, b) {   // entre dos vectores unitarios, en grados
    return Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) * DEG;
  }
  // Refracción atmosférica (Sæmundsson). Altitud verdadera → aparente, grados.
  function refract(alt) {
    if (alt < -1.5 || alt > 89.9) return alt;
    return alt + 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * RAD) / 60;
  }

  /* ---------- Planetas: elementos keplerianos JPL (Standish), 1800–2050 ----------
     a [UA], e, I [°], L [°], ϖ [°], Ω [°] y sus tasas por siglo juliano.        */
  var EL = {
    mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    venus:   [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    earth:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
    mars:    [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    saturn:  [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
    uranus:  [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
    neptune: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664]
  };
  var PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

  // Posición heliocéntrica en eclíptica J2000 [UA]
  function helio(name, T) {
    var k = EL[name];
    var a = k[0] + k[1] * T, e = k[2] + k[3] * T, I = (k[4] + k[5] * T) * RAD,
        L = k[6] + k[7] * T, wb = k[8] + k[9] * T, O = (k[10] + k[11] * T) * RAD;
    var w = (wb * RAD) - O, M = norm180(L - wb) * RAD;
    var E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    for (var i = 0; i < 8; i++) {
      var dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    var xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O),
        cI = Math.cos(I), sI = Math.sin(I);
    return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
            (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
            (sw * sI) * xp + (cw * sI) * yp];
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function len(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }

  // Magnitud visual aproximada (sin anillos de Saturno)
  function planetMag(name, r, d, phaseDeg) {
    var b = 5 * Math.log(r * d) / Math.LN10, i = phaseDeg;
    switch (name) {
      case 'mercury': return -0.42 + b + 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i;
      case 'venus': return -4.40 + b + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
      case 'mars': return -1.52 + b + 0.016 * i;
      case 'jupiter': return -9.40 + b + 0.005 * i;
      case 'saturn': return -8.88 + b + 0.044 * i;
      case 'uranus': return -7.19 + b;
      case 'neptune': return -6.87 + b;
    }
    return 0;
  }

  /* Planeta geocéntrico. Devuelve vectores en ecuatorial de la fecha. */
  function planet(name, jd) {
    var T = centuriesTT(jd);
    var e = helio('earth', T), p = helio(name, T), g = sub(p, e), d = len(g);
    // Corrección de tiempo de luz (una iteración basta)
    p = helio(name, T - d * 0.0057755183 / 36525);
    g = sub(p, e); d = len(g);
    var r = len(p), R = len(e);
    var phase = Math.acos(clamp((r * r + d * d - R * R) / (2 * r * d), -1, 1)) * DEG;
    var elong = Math.acos(clamp((R * R + d * d - r * r) / (2 * R * d), -1, 1)) * DEG;
    var P = precessionMatrix(T), q = apply(P, eclToEqu0(g)), rd = raDecFromVec(q);
    return {
      id: name, vec: [q[0] / d, q[1] / d, q[2] / d], ra: rd.ra, dec: rd.dec,
      dist: d, sunDist: r, phase: phase, elong: elong,
      illum: (1 + Math.cos(phase * RAD)) / 2, mag: planetMag(name, r, d, phase),
      helio: p
    };
  }

  function sun(jd) {
    var T = centuriesTT(jd), e = helio('earth', T), R = len(e);
    var g = [-e[0], -e[1], -e[2]];
    var q = apply(precessionMatrix(T), eclToEqu0(g)), rd = raDecFromVec(q);
    var eps = obliquity(T);
    var lon = norm360(Math.atan2(q[1] * Math.cos(eps) + q[2] * Math.sin(eps), q[0]) * DEG);
    return { id: 'sun', vec: [q[0] / R, q[1] / R, q[2] / R], ra: rd.ra, dec: rd.dec,
             dist: R, lon: lon, mag: -26.74, semidiam: 0.26657 / R };
  }

  /* ---------- Luna: Meeus cap. 47 (términos principales) ---------- */
  // [D, M, M', F, Σl (1e-6°), Σr (1e-3 km)]
  var ML = [
    [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],
    [0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],
    [2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
    [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
    [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],
    [0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],
    [4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],
    [1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
    [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],
    [0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],
    [1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],
    [0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
    [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0]
  ];
  // [D, M, M', F, Σb (1e-6°)]
  var MB = [
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
    [2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],
    [2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
    [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],
    [2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
    [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
    [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
    [4,0,0,-1,1021]
  ];
  function moonEcliptic(T) {
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T,
        D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T) * RAD,
        M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * RAD,
        Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T) * RAD,
        F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * RAD,
        A1 = (119.75 + 131.849 * T) * RAD, A2 = (53.09 + 479264.290 * T) * RAD,
        A3 = (313.45 + 481266.484 * T) * RAD,
        E = 1 - 0.002516 * T - 0.0000074 * T * T, E2 = E * E;
    var sl = 0, sr = 0, sb = 0, i, t, arg, f;
    for (i = 0; i < ML.length; i++) {
      t = ML[i]; arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      f = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E2);
      sl += t[4] * f * Math.sin(arg); sr += t[5] * f * Math.cos(arg);
    }
    for (i = 0; i < MB.length; i++) {
      t = MB[i]; arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      f = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E2);
      sb += t[4] * f * Math.sin(arg);
    }
    var LpR = Lp * RAD;
    sl += 3958 * Math.sin(A1) + 1962 * Math.sin(LpR - F) + 318 * Math.sin(A2);
    sb += -2235 * Math.sin(LpR) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F) +
      175 * Math.sin(A1 + F) + 127 * Math.sin(LpR - Mp) - 115 * Math.sin(LpR + Mp);
    return { lon: norm360(Lp + sl / 1e6), lat: sb / 1e6, distKm: 385000.56 + sr / 1000 };
  }

  /* Luna. Si se entrega el observador {lat, lon} devuelve posición topocéntrica
     (la paralaje lunar llega a 1°, no se puede ignorar). */
  function moon(jd, obs) {
    var T = centuriesTT(jd), m = moonEcliptic(T), eps = obliquity(T);
    var l = m.lon * RAD, b = m.lat * RAD, cb = Math.cos(b);
    var x = cb * Math.cos(l), y = cb * Math.sin(l), z = Math.sin(b);
    var q = [x, y * Math.cos(eps) - z * Math.sin(eps), y * Math.sin(eps) + z * Math.cos(eps)];
    var s = sun(jd);
    var elong = angSep(q, s.vec);
    var dl = norm360(m.lon - s.lon);
    var out = {
      id: 'moon', lon: m.lon, lat: m.lat, distKm: m.distKm, dist: m.distKm / AU_KM,
      elong: elong, illum: (1 - Math.cos(elong * RAD)) / 2, waxing: dl < 180,
      age: dl / 360 * 29.530589, phaseAngle: dl, mag: -12.7,
      semidiam: Math.asin(1737.4 / m.distKm) * DEG
    };
    var geo = raDecFromVec(q);
    out.geoRa = geo.ra; out.geoDec = geo.dec;
    if (obs) {
      var th = lst(jd, obs.lon) * RAD, p = obs.lat * RAD, rho = EARTH_R_KM / m.distKm;
      q = [q[0] - rho * Math.cos(p) * Math.cos(th), q[1] - rho * Math.cos(p) * Math.sin(th),
           q[2] - rho * Math.sin(p)];
      var n = len(q); q = [q[0] / n, q[1] / n, q[2] / n];
    }
    var rd = raDecFromVec(q);
    out.vec = q; out.ra = rd.ra; out.dec = rd.dec;
    return out;
  }

  /* ---------- Observador ---------- */
  // Matriz J2000 → horizontal para un lugar y un instante (para estrellas y cielo profundo)
  function skyMatrix(jd, lat, lon) {
    return mul(localMatrix(lst(jd, lon), lat), precessionMatrix(centuriesTT(jd)));
  }
  // Matriz ecuatorial de la fecha → horizontal (para Sol, Luna y planetas)
  function dateMatrix(jd, lat, lon) { return localMatrix(lst(jd, lon), lat); }

  function body(id, jd, obs) {
    if (id === 'sun') return sun(jd);
    if (id === 'moon') return moon(jd, obs);
    return planet(id, jd);
  }
  function horizontal(id, jd, obs) {
    var b = body(id, jd, obs);
    var h = azAltFromEnu(apply(dateMatrix(jd, obs.lat, obs.lon), b.vec));
    b.az = h.az; b.alt = h.alt; b.altApp = refract(h.alt);
    return b;
  }
  // Altitud verdadera de un punto fijo J2000
  function fixedAlt(v0, jd, obs) {
    return azAltFromEnu(apply(skyMatrix(jd, obs.lat, obs.lon), v0));
  }

  /* ---------- Salidas, puestas y culminación ----------
     altFn(jd) → altitud verdadera en grados. Busca en [jd0, jd0+spanDays]. */
  function crossings(altFn, jd0, spanDays, h0, stepMin) {
    var step = (stepMin || 6) / 1440, out = [], prev = altFn(jd0) - h0, t;
    for (t = jd0 + step; t <= jd0 + spanDays + 1e-9; t += step) {
      var cur = altFn(t) - h0;
      if ((prev < 0) !== (cur < 0)) {
        var a = t - step, b = t, fa = prev;
        for (var i = 0; i < 18; i++) {
          var m = (a + b) / 2, fm = altFn(m) - h0;
          if ((fa < 0) !== (fm < 0)) b = m; else { a = m; fa = fm; }
        }
        out.push({ jd: (a + b) / 2, rising: cur > 0 });
      }
      prev = cur;
    }
    return out;
  }
  function transit(altFn, jd0, spanDays) {
    var best = -91, bt = jd0, t, step = 6 / 1440;
    for (t = jd0; t <= jd0 + spanDays; t += step) { var a = altFn(t); if (a > best) { best = a; bt = t; } }
    var lo = bt - step, hi = bt + step;
    for (var i = 0; i < 20; i++) {
      var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (altFn(m1) < altFn(m2)) lo = m1; else hi = m2;
    }
    return { jd: (lo + hi) / 2, alt: altFn((lo + hi) / 2) };
  }
  var H0 = { sun: -0.833, moon: -0.833, star: -0.567, civil: -6, nautical: -12, astro: -18 };

  function altOf(id, obs) {
    return function (jd) { return horizontal(id, jd, obs).alt; };
  }
  function altOfFixed(v0, obs) {
    return function (jd) { return fixedAlt(v0, jd, obs).alt; };
  }

  /* ---------- Fases de la Luna ---------- */
  // Próximo instante en que (λLuna − λSol) = target (0 nueva, 90 creciente, 180 llena, 270 menguante)
  function nextPhase(jd, target) {
    function f(t) { return norm180(moon(t).phaseAngle - target); }
    var step = 0.5, a = jd, fa = f(a), b, fb;
    for (var i = 0; i < 80; i++) {
      b = a + step; fb = f(b);
      if (fa < 0 && fb >= 0 && fb - fa < 90) break;
      a = b; fa = fb;
    }
    for (i = 0; i < 30; i++) {
      var m = (a + b) / 2, fm = f(m);
      if (fm < 0) { a = m; } else { b = m; }
    }
    return (a + b) / 2;
  }

  return {
    RAD: RAD, DEG: DEG, AU_KM: AU_KM, LY_AU: LY_AU, PLANETS: PLANETS, H0: H0, GAL: GAL, EPS0: EPS0,
    norm360: norm360, norm180: norm180, clamp: clamp,
    jdFromMs: jdFromMs, msFromJd: msFromJd, deltaT: deltaT, centuriesTT: centuriesTT,
    gmst: gmst, lst: lst, obliquity: obliquity,
    mul: mul, apply: apply, transpose: transpose,
    precessionMatrix: precessionMatrix, localMatrix: localMatrix,
    skyMatrix: skyMatrix, dateMatrix: dateMatrix,
    vecFromRaDec: vecFromRaDec, raDecFromVec: raDecFromVec,
    azAltFromEnu: azAltFromEnu, enuFromAzAlt: enuFromAzAlt,
    eclToEqu0: eclToEqu0, equ0ToEcl: equ0ToEcl, angSep: angSep, refract: refract,
    helio: helio, planet: planet, sun: sun, moon: moon, body: body,
    horizontal: horizontal, fixedAlt: fixedAlt,
    crossings: crossings, transit: transit, altOf: altOf, altOfFixed: altOfFixed,
    nextPhase: nextPhase
  };
})();
if (typeof module !== 'undefined') module.exports = Astro;
