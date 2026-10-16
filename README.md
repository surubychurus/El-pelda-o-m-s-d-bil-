# Manhunt

App móvil (Android e iOS) de manhunt en la vida real. Plan completo en [PLAN.md](PLAN.md).

- `app/`: app Expo (React Native). `cd app && npm install && npx expo start`
- `server/`: servidor Fastify + WebSocket sobre Neon. Despliegue en el VPS en [server/DEPLOY.md](server/DEPLOY.md).

## Desarrollo local
1. `cd server && cp .env.example .env`, rellena `DATABASE_URL` (Neon) y `JWT_SECRET`.
2. `npm install && npm run db:migrate && npm run dev`
3. En `app/`, crea `.env` con `EXPO_PUBLIC_API_URL=http://<ip-de-tu-pc>:3000` y ejecuta `npx expo start`.
