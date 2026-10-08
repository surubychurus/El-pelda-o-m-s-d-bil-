# Notificaciones custom (Capacitor + Android)

App para programar notificaciones locales con título, texto, texto largo, fecha/hora,
repetición, prioridad, icono, color, notificación fija y hasta 3 botones
(normal, "Posponer 10 min", con campo de texto, o sin abrir la app).

## Obtener el APK
- **Sin instalar nada:** pestaña *Actions* → *Build APK* → descarga el artefacto `notificaciones-debug-apk`.
- **En local** (Node 22, JDK 21, Android SDK): `npm install && npm run apk`
  → `android/app/build/outputs/apk/debug/app-debug.apk`.

Instala el APK en el móvil (permite "orígenes desconocidos") y acepta el permiso de notificaciones.

## Estructura
- `www/` interfaz (HTML/JS sin bundler, usa `@capacitor/local-notifications`).
- `android/app/src/main/res/drawable/ic_stat_*.xml` iconos disponibles; añade más ahí y en `ICONS` de `www/app.js`.
- Tras editar `www/`: `npm run sync`.
