/* Pruebas del motor astronómico contra PyEphem.  Uso: node tests/test_astro.js */
var fs = require('fs'), path = require('path');
var A = require('../src/astro.js'), C = require('../src/data.js');
var ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference.json')));
var obs = { lat: ref.lat, lon: ref.lon }, fail = 0;
function sep(ra1, d1, ra2, d2) { return A.angSep(A.vecFromRaDec(ra1, d1), A.vecFromRaDec(ra2, d2)); }
function check(name, value, limit, unit) {
  var ok = value <= limit; if (!ok) fail++;
  console.log((ok ? '  ok   ' : '  FALLA ') + name.padEnd(34) + value.toFixed(4).padStart(9) + ' ' + unit + '  (límite ' + limit + ')');
}
// Tolerancias en grados: geocéntrico y horizontal
var tol = { sun: 0.02, moon: 0.05, mercury: 0.05, venus: 0.05, mars: 0.08, jupiter: 0.2, saturn: 0.25, uranus: 0.2, neptune: 0.2 };
var worst = {}, worstH = {}, worstS = 0;
ref.cases.forEach(function (c) {
  var jd = A.jdFromMs(c.unix_ms);
  Object.keys(c.b).forEach(function (id) {
    var r = c.b[id], b = id === 'moon' ? A.moon(jd) : A.body(id, jd);
    var ra = id === 'moon' ? b.geoRa : b.ra, dec = id === 'moon' ? b.geoDec : b.dec;
    worst[id] = Math.max(worst[id] || 0, sep(ra, dec, r[0], r[1]));
    var h = A.horizontal(id, jd, obs);
    worstH[id] = Math.max(worstH[id] || 0, A.angSep(A.enuFromAzAlt(h.az, h.alt), A.enuFromAzAlt(r[2], r[3])));
  });
  var s = A.fixedAlt(A.vecFromRaDec(101.28716, -16.71611), jd, obs);
  worstS = Math.max(worstS, A.angSep(A.enuFromAzAlt(s.az, s.alt), A.enuFromAzAlt(c.sirius[0], c.sirius[1])));
});
console.log('Error máximo geocéntrico (AR/Dec) en ' + ref.cases.length + ' fechas 2024–2035:');
Object.keys(tol).forEach(function (id) { check(id, worst[id], tol[id], '°'); });
console.log('Error máximo horizontal (Az/Alt) desde Ovalle:');
Object.keys(tol).forEach(function (id) { check(id, worstH[id], tol[id] + 0.02, '°'); });
check('estrella fija (Sirio, con precesión)', worstS, 0.02, '°');
console.log('Salidas, puestas y fases:');
ref.riseset.forEach(function (r) {
  var jd0 = A.jdFromMs(r.from_ms);
  var sc = A.crossings(A.altOf('sun', obs), jd0, 1.2, A.H0.sun);
  var set = sc.filter(function (x) { return !x.rising; })[0], rise = sc.filter(function (x) { return x.rising; })[0];
  check('puesta del Sol', Math.abs(A.msFromJd(set.jd) - r.sunset) / 60000, 0.5, 'min');
  check('salida del Sol', Math.abs(A.msFromJd(rise.jd) - r.sunrise) / 60000, 0.5, 'min');
  var mc = A.crossings(A.altOf('moon', obs), jd0, 1.6, A.H0.moon).filter(function (x) { return x.rising; })[0];
  check('salida de la Luna', Math.abs(A.msFromJd(mc.jd) - r.moonrise) / 60000, 1, 'min');
  check('Luna llena', Math.abs(A.msFromJd(A.nextPhase(jd0, 180)) - r.full) / 60000, 3, 'min');
  check('Luna nueva', Math.abs(A.msFromJd(A.nextPhase(jd0, 0)) - r.new) / 60000, 3, 'min');
});
console.log('Geometría:');
var gc = A.raDecFromVec(A.apply(A.GAL, [1, 0, 0]));
check('centro galáctico (AR 266.405, Dec −28.936)', sep(gc.ra, gc.dec, 266.405, -28.936), 0.01, '°');
var gp = A.raDecFromVec(A.apply(A.GAL, [0, 0, 1]));
check('polo norte galáctico', sep(gp.ra, gp.dec, 192.859, 27.128), 0.01, '°');
check('refracción en el horizonte (≈0.48°)', Math.abs(A.refract(0) - 0.48), 0.03, '°');
console.log('Catálogo:');
check('estrellas (≥5000)', -C.stars.length / 4, -5000, '');
var si = C.special.sirius * 4;
check('Sirio es la más brillante', Math.abs(C.stars[si + 2] + 144), 3, 'cmag');
var badLines = 0;
Object.keys(C.lines).forEach(function (k) { C.lines[k].forEach(function (s) { if (s.length < 2) badLines++; }); });
check('líneas de constelación válidas', badLines, 0, '');
console.log(fail ? '\n' + fail + ' PRUEBAS FALLARON' : '\nTodas las pruebas pasaron');
process.exit(fail ? 1 : 0);
