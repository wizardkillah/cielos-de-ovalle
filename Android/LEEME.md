# Cielos de Ovalle · APK de Android

Envoltorio [Capacitor](https://capacitorjs.com) de `App/cielos-de-ovalle.html`. La app viaja empaquetada dentro del APK (sin servidor, sin conexión) y el WebView la sirve desde `https://localhost`, que cuenta como contexto seguro: **brújula, cámara y GPS funcionan sin publicar nada**.

- Paquete: `cl.cielosdeovalle.app` · mínimo Android 7.0 (API 24)
- Permisos: cámara, ubicación (los pide al usar 📷 y 📍)

## Instalar el APK en el teléfono
1. Copia `Android/cielos-de-ovalle-debug.apk` al teléfono (cable, Drive, WhatsApp a ti mismo…).
2. Ábrelo y permite «instalar apps desconocidas» para esa aplicación cuando Android lo pida.
3. O con cable y depuración USB: `adb install -r cielos-de-ovalle-debug.apk`.

El APK es de **depuración** (firmado con la clave de debug). Sirve para pruebas y para repartir directamente. Para Google Play hay que generar un AAB firmado con una clave propia.

## Reconstruir
Requisitos: Node, JDK 17 y Android SDK (platform 36, build-tools 36.0.0).

```bash
cd Android
npm install
python scripts/hacer-iconos.py        # solo si cambia App/icono.svg
node scripts/copiar-web.js            # copia App/cielos-de-ovalle.html → www/index.html
npx cap sync android
# en Android/android/local.properties:  sdk.dir=<ruta al Android SDK>
cd android && ./gradlew assembleDebug
# resultado: android/app/build/outputs/apk/debug/app-debug.apk
```

Cada vez que cambie la app (`python App/fuente/build.py` y copiar a `App/`), repite `copiar-web` + `cap sync` + `assembleDebug`.

## Nota para Windows con usuario de nombre largo
Si Gradle falla con `Unable to establish loopback connection` (el socket Unix de Java no admite la ruta temporal corta `NOMBRE~1`), usa JDK 21 y define una carpeta temporal simple:
```bash
mkdir C:/gt
export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=C:/gt"
```
