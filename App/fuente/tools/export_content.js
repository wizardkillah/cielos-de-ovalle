/* Exporta el contenido de la app a JSON para generar las fichas de la bóveda.
   Uso: node tools/export_content.js > content.json */
var C = require('../src/content.js'), K = require('../src/data.js'), stars = {};
Object.keys(C.stars).forEach(function (k) {
  var i = K.special[k];
  stars[k] = Object.assign({}, C.stars[k], { ra: K.stars[i * 4] / 1000, dec: K.stars[i * 4 + 1] / 1000, mag: K.stars[i * 4 + 2] / 100, bv: K.stars[i * 4 + 3] / 100, names: K.names[i] });
});
process.stdout.write(JSON.stringify({ bodies: C.bodies, stars: stars, dsos: C.dsos, sites: C.sites, cons: K.cons }));
