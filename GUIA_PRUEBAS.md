# Guía para probar Manhunt en tu móvil (Android)

Necesitas: el servidor en tu VPS funcionando, una cuenta gratuita de Expo y un Android. Para iOS hace falta una cuenta de Apple Developer (99 USD/año), así que esta guía es solo Android.

## 1. Servidor en el VPS
Sigue [server/DEPLOY.md](server/DEPLOY.md). Resumen de lo que debe quedar listo:
1. Subdominio con registro `A` apuntando al VPS (por ejemplo `api.tudominio.com`).
2. `server/.env` con tu `DATABASE_URL` de Neon (consola de Neon → Connect) y un `JWT_SECRET` (`openssl rand -hex 32`).
3. Las tablas ya están creadas en tu Neon. `npm run db:migrate` no repite nada.
4. Comprueba que responde desde fuera:
   ```bash
   curl https://api.tudominio.com/health      # → {"ok":true}
   ```
   Si no responde, mira `journalctl -u manhunt -f` en el VPS.

## 2. Poner tu dirección en la app
Edita `app/eas.json` y cambia las dos apariciones de `https://api.tudominio.com` por tu subdominio. Esa dirección se graba dentro de la app al compilarla.

## 3. Compilar la app (build de desarrollo, en la nube, gratis)
En tu PC, con Node 20+ y el repo clonado:
```bash
npm i -g eas-cli
eas login                      # cuenta de expo.dev (gratuita)
cd app
npm install
eas init                       # crea el proyecto en Expo y añade su id a app.json
eas build --profile development --platform android
```
- La primera vez te pregunta si EAS puede generar la clave de firma: di que sí.
- Tarda unos 10-20 minutos. Al terminar da un **enlace y un QR** para descargar el `.apk`.
- Ábrelo en el móvil e instálalo (Android pedirá permitir "instalar apps desconocidas" desde el navegador).
- Este build es el que permite ubicación en segundo plano, cámara y mapa. **Expo Go no sirve.**

Cuando cambies solo código de la app (no dependencias nativas), no hace falta recompilar: basta el paso 4.

## 4. Arrancar el código en tu PC y abrirlo en el móvil
```bash
cd app
echo "EXPO_PUBLIC_API_URL=https://api.tudominio.com" > .env
npx expo start --dev-client
```
Abre la app **Manhunt** (la que instalaste) y escanea el QR de la terminal, o elige el servidor que aparece. Móvil y PC deben estar en la misma wifi.

## 5. Permisos en el móvil (importante)
1. **Ubicación:** cuando Android pregunte, elige **"Permitir todo el tiempo"**. En Android 11 o superior solo aparece en los ajustes: Ajustes → Apps → Manhunt → Permisos → Ubicación → "Permitir todo el tiempo", con precisión alta.
2. **Cámara:** permitir (para escanear QR).
3. **Batería:** Ajustes → Apps → Manhunt → Batería → "Sin restricciones". Si no, el sistema puede dormir la app con la pantalla apagada y dejar de enviar tu posición.

## 6. Plan de prueba (mejor con 2 o 3 móviles)
Para ir rápido, en la sala pon **Duración 5 min**, **Espera 1 min**, **Alerta cada 1 min**, **Alerta dura 30 s**, **Radio 300 m**.
1. Móvil A crea la sala y comparte el código. Los demás entran con apodo.
2. A pulsa **Empezar partida aquí** (el punto de inicio es donde está A).
3. Se ve la revelación del rol y la cuenta atrás de espera.
4. Cuando acaba la espera, empieza el juego. Con la alerta aparece el mapa: puntos anónimos, cazadores en rojo, tu posición en blanco. El móvil vibra.
5. El escondido abre **Mi QR**. El cazador abre **Escanear QR** y lo apunta, a menos de 50 m.
6. Comprueba: aviso de captura al capturado, cambio de rol, fin de partida con ganador.
7. Sal del radio caminando y mira el aviso rojo.
8. Bloquea la pantalla de un móvil 2 minutos y mira, en la alerta del otro, que su punto sigue moviéndose.

## 7. Si algo falla
| Síntoma | Qué mirar |
|---|---|
| "No se pudo conectar" al poner el apodo | La URL de `eas.json`/`.env` está mal, o el servidor no responde (`curl .../health`). |
| La app abre pero sala y lobby no se actualizan | El WebSocket no llega: Caddy debe estar delante del servidor (lo hace el `Caddyfile` incluido). |
| El mapa sale gris | Sin internet en el móvil: las teselas vienen de OpenFreeMap. |
| No aparece mi punto para los demás | Permiso "todo el tiempo" y batería sin restricciones. |
| El escáner no lee el QR | Más luz y acercarse; el QR debe verse entero. |

Cuando algo falle, cópiame solo el **mensaje de error** o dime qué viste en la pantalla. No me pegues contraseñas ni la cadena de conexión.
