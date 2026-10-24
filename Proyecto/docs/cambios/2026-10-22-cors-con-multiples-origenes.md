# CORS con múltiples orígenes y `DATABASE_URL` desde `.env`

**Fecha:** 2026-10-22 · **Épica:** KAN-88

`CORS_ORIGIN` (singular, la que realmente leía `@fastify/cors`) solo
permitía `localhost:4200`, pero `admin-site` corre en `:4300`: el navegador
bloqueaba sus requests con `CORS policy`.

`env.ts` ahora parsea `CORS_ORIGINS` (plural, lista separada por coma) como
arreglo y es la única variable que se usa; se eliminó la `CORS_ORIGIN`
duplicada de los `.env`. `DATABASE_URL` se toma del `.env` del backend.

**Por qué**: desbloquear a quien probara `admin-site` contra el backend
local.

**Toca**: `apps/backend/src/config/env.ts`, `apps/backend/src/server/app.ts`,
`apps/backend/.env`, `apps/backend/.env.example`.
