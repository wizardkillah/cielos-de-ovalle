---
tags: [guia, despliegue]
---
# Publicar la app

## Por qué publicarla
Abierta con doble clic funciona casi todo. Pero **brújula, cámara, GPS e instalación como app** exigen que el navegador la reciba por `https://`. Publicarla toma unos minutos y es gratis.

## Qué subir
Los cuatro archivos de la carpeta `App`:

```
cielos-de-ovalle.html     la aplicación completa
manifest.webmanifest      nombre, icono y colores al instalarla
sw.js                     la deja disponible sin conexión
icono.svg
```

Si quieres que se abra directamente en la dirección raíz, sube además una copia de `cielos-de-ovalle.html` con el nombre `index.html`.

## Tres caminos

### A · Netlify Drop (el más rápido, sin cuenta técnica)
1. Entra a `app.netlify.com/drop`.
2. Arrastra la carpeta `App`.
3. Obtienes una dirección `https://…netlify.app`. Puedes cambiarle el nombre.

### B · GitHub Pages (queda versionado)
1. Crea un repositorio público, por ejemplo `cielos-de-ovalle`.
2. Sube los cuatro archivos (y `index.html`).
3. *Settings → Pages → Deploy from a branch → main / root*.
4. Dirección: `https://<usuario>.github.io/cielos-de-ovalle/`.

### C · Cloudflare Pages
Conecta el repositorio o sube la carpeta desde el panel. Sin comando de construcción.

Con un dominio propio (por ejemplo del observatorio o del municipio), cualquiera de las tres opciones permite apuntarlo.

## Probar que quedó bien
- [ ] La dirección empieza con `https://`.
- [ ] En el teléfono: pulsar 🧭 pide permiso (iPhone) o empieza a seguir el movimiento (Android).
- [ ] Menú del navegador → «Agregar a pantalla de inicio» o «Instalar app».
- [ ] Activar modo avión y volver a abrirla: debe cargar igual.

## Para el observatorio
- **Código QR** impreso en la recepción y en el sendero, apuntando a la dirección. Imprímelo en rojo oscuro sobre negro para no deslumbrar de noche.
- Pide a los visitantes abrirla **antes de subir**, mientras hay señal: queda guardada.
- Deja un teléfono de respaldo con la app instalada para quien no pueda cargarla.

## Publicar una actualización
1. Edita `App/fuente/src/…` y ejecuta `python3 build.py`.
2. Corre las pruebas ([[Precisión y pruebas]]).
3. **Cambia el nombre de caché** en `sw.js`:
   ```js
   var CACHE = 'cielos-ovalle-v1.0.1';
   ```
   Si no lo cambias, los teléfonos seguirán mostrando la versión anterior.
4. Sube los archivos.

## Privacidad
La app no envía datos a ningún servidor, no usa cookies ni analítica. La ubicación y la imagen de la cámara no salen del teléfono. Lo único que pide a internet son dos tipografías de Google Fonts; si no hay conexión usa las del sistema. Para evitar incluso esa consulta, borra la línea `<link … fonts.googleapis.com …>` de `src/index.html` y reconstruye.

## Costos
Cero para este tamaño y tráfico en cualquiera de los tres servicios, a noviembre de 2026. Conviene revisar las condiciones vigentes de cada uno.
