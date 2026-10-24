# Guía de CRUD de punta a punta

**Fecha:** 2026-10-24 · **Épica:** KAN-86 (aplica a todas) · **Ticket:** KAN-118 (ejemplo)

Nueva carpeta `docs/desarrollo/crud/` con una guía para hacer un CRUD
completo atravesando todas las capas: `domain` → `application` →
`infrastructure` → rutas Fastify → Angular. Usa `categoria` de ejemplo,
porque `GET/POST /categorias` ya existen y lo que falta (obtener, actualizar,
eliminar y la pantalla de admin-site) es KAN-118.

Organizada como 15 pasos numerados (0 a 14): el índice tiene el mapa y los
pasos 0 y 14, y cuatro archivos numerados en orden de lectura (capas del
backend, rutas HTTP, base Angular, pantallas Angular) cubren el resto, sin
pasar de ~200 líneas cada uno. `RESUMEN-Y-PORQUE.md` junta toda la guía
en una página sin código. Primero presenta los siete principios de la
arquitectura (regla de dependencia, puertos y adaptadores, dependencias
explícitas, una pregunta por capa, backend como autoridad, contrato único,
`core/` + `features/`) y después explica qué principio aplica en cada paso.
Cada paso de los archivos detallados lleva una nota "Por qué así" que
remite a esos principios.

Deja escritas las trampas que tiene el código hoy, para que no se descubran
a mitad de un ticket:

- Un `ZodError` cae en el `500` de `setErrorHandler` en vez de un 400
  `VALIDATION_ERROR`; la guía trae el arreglo.
- `requireRol("administrador")` no calza con el rol `admin_general` del seed
  (decisión abierta #1).
- Sin `POST /auth/login` no hay token: la guía explica cómo firmarlo a mano
  con el `JWT_SECRET` del `.env`.
- `ApiClient` de los frontends solo tiene `get` y no hay interceptor de auth.
- Las pruebas de escritura con `curl` contra un `DATABASE_URL` de Aiven
  escriben en la base compartida.

No cambia código: el código de la guía es la propuesta para KAN-118 y los
siguientes CRUD.

**Por qué**: el README del proyecto solo mostraba listar y crear en el
backend; quien tomaba un CRUD tenía que deducir el resto (params, 404/409,
token, frontend) leyendo el código.

**Toca**: `docs/desarrollo/crud/{README,RESUMEN-Y-PORQUE,1-BACKEND-CAPAS,2-BACKEND-RUTAS,3-FRONTEND-BASE,4-FRONTEND-PANTALLAS}.md`,
`docs/desarrollo/README.md`, `README.md` (enlace desde "Cómo agregar una
funcionalidad nueva").
