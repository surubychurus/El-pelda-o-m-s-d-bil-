# Manhunt en la vida real: plan

App móvil (Android e iOS) para jugar al manhunt por la ciudad con amigos. Para jugar entre amigos ahora, con posibilidad de publicarla en las tiendas más adelante.

## Stack
- **App:** Expo (React Native + TypeScript), Expo Router.
- **Base de datos:** Neon (Postgres), con Drizzle ORM y el driver `pg` (conexión TCP normal, sin necesidad del driver serverless porque el servidor corre en un VPS).
- **Backend:** Node + TypeScript con Fastify y WebSocket (`ws`). Neon solo es base de datos, así que el servidor propio hace el tiempo real, el login y las validaciones. Se despliega en un host con procesos persistentes (Fly.io o Render, a decidir), porque Vercel no mantiene WebSockets.
- **Login:** apodo, sin registro. El servidor crea un usuario por instalación y emite un JWT. Más adelante se puede vincular un email o Google a esa misma cuenta sin perder datos.
- **Mapa:** MapLibre.
- **Estilo:** Three.js (`@react-three/fiber`) para el radar 3D de fondo y GSAP para las animaciones de interfaz. El 3D se pausa en segundo plano y durante la fase de juego para ahorrar batería.
- **Ubicación:** `expo-location` en primer plano y en segundo plano.
- **QR:** `expo-camera` para escanear y `react-native-qrcode-svg` para mostrar el propio.

## Reglas del juego

### Modos
1. **Clásico:** 1 cazador y el resto se esconde por su cuenta. El cazador se elige al azar o lo elige el creador.
2. **Equipos:** el creador define cuántos cazadores hay. Se asignan al azar al empezar. El resto son escondidos.

### Salas
- El creador crea la sala y recibe un **código de 4 letras**. También hay un enlace que incluye el código.
- Los jugadores entran con el código y su apodo.
- La sala tiene un lobby donde el creador ve quién ha entrado y configura la partida.

### Configuración de la sala (la define el creador)
| Parámetro | Descripción | Por defecto |
|---|---|---|
| Modo | Clásico o Equipos | Clásico |
| Nº de cazadores | Solo en Equipos | 2 |
| Elección del cazador | Azar o manual, solo en Clásico | Azar |
| Duración | Tiempo total de la partida | 60 min |
| **Espera** | Ventaja de los escondidos antes de que salgan los cazadores | 5 min |
| Radio de juego | Radio desde el punto de inicio | 500 m |
| Frecuencia de alerta | Cada cuánto salta la alerta automática | 10 min |
| Duración de la alerta | Tiempo que dura el mapa visible | 1 min |
| Al ser capturado | Eliminado (espectador) o se une a los cazadores | Eliminado |

### Flujo de la partida
1. **Lobby:** los jugadores entran. El creador configura la sala, fija el punto de inicio y arranca.
2. **Espera:** los escondidos se esconden. Los cazadores ven la cuenta atrás y no ven el mapa.
3. **En juego:** salen los cazadores. Corre el tiempo de la partida.
4. **Alerta:** todos ven un mapa con los puntos de todos los demás. Los puntos son anónimos, y los cazadores salen destacados. La alerta dura el tiempo configurado y luego el mapa se oculta. Salta por intervalo o cuando el creador pulsa el botón manual.
5. **Captura:** el cazador escanea el QR del escondido estando cerca. La app valida la distancia con el GPS. El capturado pasa al estado definido en la sala.
6. **Fin:** ganan los escondidos si el tiempo se acaba con alguno vivo. Ganan los cazadores si capturan a todos. Se muestra una pantalla de resultados.

### Reglas pendientes
- Qué pasa si un jugador sale del radio de juego: de momento solo se le avisa en la app.
- Qué pasa si alguien pierde la conexión o cierra la app durante la partida.
- Distancia máxima para validar una captura: 10 m (valor propuesto).

## Modelo de datos (Neon)
- `players`: `id` (= `auth.uid`), `nickname`, `created_at`.
- `rooms`: `id`, `code`, `owner_id`, `status` (`lobby`, `waiting`, `playing`, `finished`), `config` (jsonb), `origin_lat`, `origin_lng`, `started_at`.
- `room_players`: `room_id`, `player_id`, `role` (`hunter`, `hider`, `spectator`), `status` (`alive`, `captured`), `qr_token`.
- `locations`: `room_id`, `player_id`, `lat`, `lng`, `updated_at`.
- `captures`: `room_id`, `hunter_id`, `hider_id`, `at`.
- `alerts`: `room_id`, `started_at`, `ends_at`, `triggered_by`.

**Seguridad:** la app nunca habla con la base de datos, solo con el servidor. El servidor guarda las ubicaciones pero solo las envía a los demás durante una alerta activa, como puntos anónimos. Las capturas se validan en el servidor: comprueba el token del QR, la distancia y los roles.

## Fases

**Fase 0: base** (hecha)
- Proyecto Expo, navegación y tema.
- Servidor Fastify, base de datos en Neon y migraciones con Drizzle.
- Login con apodo y JWT.

**Fase 1: salas** (hecha)
- Crear sala, unirse con código, lobby en tiempo real.
- Pantalla de configuración del creador.

**Fase 2: partida**
- Roles y asignación al azar, máquina de estados (espera, juego, fin).
- Envío de ubicación en segundo plano y radio de juego.

**Fase 3: alerta y captura** (hecha)
- Alerta automática y manual, con mapa anónimo y cazadores destacados.
- QR propio y escáner, validación de captura en el servidor.
- Estados capturado y espectador.

**Fase 4: pulido**
- Notificaciones push (inicio de partida, alerta, captura, fin).
- Pantalla de resultados, manejo de reconexión y batería.
- Pruebas reales con amigos en la calle.

**Fase 5: tiendas** (a futuro)
- Cuentas reales (vincular email o Google al usuario por apodo).
- Permisos de ubicación en segundo plano y políticas de privacidad para App Store y Google Play.

## Riesgos
- **Ubicación en segundo plano en iOS:** consume batería y exige justificar el permiso en App Store.
- **Precisión del GPS:** en interiores o entre edificios falla. El umbral de captura debe tolerar error.
- **Trampas:** un jugador podría falsificar su ubicación o compartir su QR. Se mitiga validando en el servidor y rotando los QR.
- **Seguridad física:** conviene avisos de jugar en lugares seguros, sin cruzar calles sin mirar y sin entrar en propiedad privada.
