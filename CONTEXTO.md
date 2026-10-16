# Contexto del proyecto Manhunt

Resumen para retomar el trabajo en una sesión nueva. Plan detallado en [PLAN.md](PLAN.md).

## Qué es
App móvil (Android e iOS) de **manhunt en la vida real** para jugar con amigos, con posibilidad de publicarla más adelante. Idioma: español.

## Reglas decididas
- **Modos:** Clásico (1 cazador, elegido al azar o por el creador) y Equipos (N cazadores al azar).
- **Salas** con código de 4 letras. El creador configura: duración, **espera** (ventaja para esconderse antes de que salgan los cazadores), radio de juego desde el punto de inicio (no se reduce), frecuencia y duración de la **alerta**, y qué pasa al ser capturado (eliminado o se une a los cazadores; por defecto eliminado).
- **Alerta:** todos ven un mapa con la ubicación de todos, de forma **anónima**, con los cazadores destacados. Salta por intervalo y con botón manual del creador. Dura 1 min por defecto. Fuera de la alerta nadie ve a nadie.
- **Captura:** el cazador escanea el **QR** del escondido, estando cerca (distancia máxima propuesta: 10 m).
- **Login:** solo apodo, cambiable. Más adelante se podrá vincular email o Google.

## Stack
- **App:** Expo (React Native + TypeScript), Expo Router, Three.js (`@react-three/fiber`) para el radar 3D de fondo y GSAP para animaciones.
- **Servidor:** Node + Fastify + WebSocket, JWT propio. Corre en el **VPS del usuario** (Ubuntu), con Caddy para HTTPS y systemd.
- **Base de datos:** **Neon** (Postgres) con Drizzle y el driver `pg`. Proyecto del usuario: org `org-hidden-sea-17300164`, proyecto `holy-scene-89752778`, rama `production`.
- **Mapa:** MapLibre (`@maplibre/maplibre-react-native` v11) con los mapas gratuitos de OpenFreeMap, estilo `dark`, sin clave. Requiere build de desarrollo (no funciona en Expo Go). En web hay un radar plano de respaldo (`components/AlertMap.tsx`).

## Estado (rama `ccr-cbe32dbd-uiuaay`)
| Fase | Estado |
|---|---|
| 0 Base: proyecto Expo, servidor, login por apodo | Hecha |
| 1 Salas: crear, unirse, lobby en tiempo real, configuración | Hecha |
| 2 Partida: empezar, roles, fases con cuenta atrás, ubicación en segundo plano, radio | Hecha |
| Estilo: radar 3D (Three.js) y animaciones (GSAP) | Hecho |
| 3 Alerta y captura: mapa anónimo (MapLibre), QR, escáner, validación en servidor | Hecha (sin probar en móvil) |
| 4 Pulido: notificaciones push, resultados, reconexión, pruebas reales | Pendiente |
| 5 Tiendas: cuentas reales, permisos y privacidad | A futuro |

## Estructura del repo
- `app/`: app Expo (`app/` pantallas, `components/`, `lib/`).
- `server/`: servidor Fastify (`src/`, migraciones en `drizzle/`, guía en `DEPLOY.md`).
- `GUIA_PRUEBAS.md`: cómo compilar con EAS y probar en un Android.
- `.mcp.json`, `.claude/skills/neon*`, `skills-lock.json`: servidor MCP de Neon (OAuth) y skills `neon` y `neon-postgres`.

## Qué se probó y qué no
- **Probado** contra un Postgres local: todo el servidor (salas, configuración, WebSocket, expulsar, salir, empezar, fases, fin por tiempo, "volver a tu partida"). Las pantallas se vieron en navegador con el 3D renderizado por software.
- **Fase 3 probada en servidor:** alerta automática y manual, puntos anónimos por WebSocket (sin ids; cada uno sin el suyo), capturas con QR (rol, estado, distancia máxima 50 m, repetidas, fin de partida) y los dos modos de captura (eliminado / pasa a cazador). El mapa se vio en una vista previa web con `maplibre-gl`; el MapLibre nativo y el escáner de cámara NO se han ejecutado en un móvil.
- **No probado:** la app en un móvil real (ubicación en segundo plano, permisos, rendimiento del 3D), ni nada contra el Neon real del usuario, ni el despliegue en el VPS.
- El bundle de Android compila (`npx expo export --platform android`).

## Base de datos (Neon)
- Proyecto `holy-scene-89752778` (región `aws-sa-east-1`, Postgres 18), rama `production` (`br-patient-night-b6sd0m9h`).
- **Esquema aplicado** (migraciones 0000-0002) y registrado en `drizzle.__drizzle_migrations`, así que `npm run db:migrate` no repite nada. Tablas en `public`: alerts, captures, locations, players, room_players, rooms.
- El proyecto también tiene tablas `neon_auth` (servicio Auth activado), que esta app no usa.
- Sin probar aún: el servidor contra este Neon (hace falta `DATABASE_URL` en `server/.env`).

## Pendiente del usuario
1. Poner `DATABASE_URL` (consola de Neon) en `server/.env` del VPS.
2. Subdominio con registro `A` al VPS; seguir `server/DEPLOY.md`.
3. Para jugar con ubicación en segundo plano hace falta un **build de desarrollo** (EAS con cuenta de Expo gratuita; iOS exige Apple Developer, 99 USD/año). Expo Go no sirve para eso.
4. Confirmar mapa: MapLibre (recomendado) o Google Maps.

## Notas importantes
- `neon init`/`neon deploy` fueron bloqueados por permisos en la sesión de Claude: los ejecuta el usuario, o se da permiso a `Bash(neon:*)`.
- El servicio `auth` de Neon no se usa: el servidor ya tiene su propio login.
- No pegar contraseñas ni cadenas de conexión en el chat.
- `app/.npmrc` tiene `legacy-peer-deps=true` por un conflicto de versiones de React.
- Reglas aún abiertas: qué pasa al salir del radio (hoy solo avisa) y al perder conexión.
