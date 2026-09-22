# apps/rest

Backend Fastify + TypeScript. Es la **capa de interfaz HTTP**: expone rutas
que llaman a los casos de uso de `@cotizapp/application`, ya conectados a sus
dependencias reales en el composition root.

## Estructura

```
src/
├── server/
│   ├── index.ts   # entrypoint: carga env, arma la app, escucha el puerto
│   └── app.ts      # buildApp(): composition root — arma repos de
│                    infrastructure, los pasa a los casos de uso de
│                    application, registra plugins y el error handler
├── routes/          # un grupo de rutas por módulo de negocio
│   ├── auth/          # (pendiente)
│   ├── catalogo/       # (pendiente)
│   ├── pedidos/        # (pendiente)
│   └── pagos/           # (pendiente)
├── plugins/          # plugins de Fastify (auth, rate-limit, etc.)
├── config/
│   └── env.ts        # validación de variables de entorno con zod
└── types/
    └── fastify.d.ts   # augmentation de FastifyInstance (decorators)
```

## Cómo correrlo

```bash
cp .env.example .env
pnpm dev            # tsx watch, puerto 3000 por defecto
pnpm test
pnpm build && pnpm start
```

## Dónde va cada cosa

- **Lógica de negocio** (casos de uso) → `packages/application`, no acá.
- **Entidades/DTOs/interfaces de repositorio** → `packages/domain`, no acá.
- **Acceso a MySQL/Drizzle** → `packages/infrastructure`, no acá.
- Acá solo va: parseo de request/response, wiring de dependencias (composition
  root), middlewares/plugins HTTP, manejo de errores.

## Manejo de errores

`app.ts` registra un `setErrorHandler` centralizado que devuelve
`{ error: { code, message } }` con el status HTTP correspondiente.
