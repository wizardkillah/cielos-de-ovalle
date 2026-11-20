// Copia la app publicada (App/) a www/ para que Capacitor la empaquete en el APK.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..', 'App');
const dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
fs.copyFileSync(path.join(src, 'cielos-de-ovalle.html'), path.join(dst, 'index.html'));
// El service worker no hace falta dentro del APK: los archivos ya viajan empaquetados.
for (const f of ['manifest.webmanifest', 'icono.svg']) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log('www/ listo');
