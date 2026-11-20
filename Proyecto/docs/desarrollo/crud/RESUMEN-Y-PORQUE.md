# CRUD en resumen: qué se hace y por qué

La guía completa en una página, sin el código: qué se hace en cada paso y
**qué parte de la arquitectura explica que se haga así**. Si es tu primer
CRUD en el proyecto, empieza por acá; el código de cada paso está en los
archivos numerados (1 a 4).

## Los principios de la arquitectura

Todo el recorrido sale de siete ideas. Cada paso de abajo dice cuál aplica.

| | Principio | Qué dice | Por qué existe |
|---|---|---|---|
| **A** | Regla de dependencia | Las dependencias apuntan hacia adentro: `apps/backend → application → domain ← infrastructure`. `domain` no importa nada de afuera. | Lo que menos cambia (las reglas del negocio) no puede depender de lo que más cambia (framework, base de datos, UI). |
| **B** | Puertos y adaptadores | `domain` declara interfaces de lo que necesita (puertos); `infrastructure` las implementa (adaptadores). | El caso de uso usa la base sin depender de ella: la implementación se puede cambiar o reemplazar por una falsa en un test. |
| **C** | Dependencias explícitas | Nada de variables globales ni contenedor de inyección. Cada pieza recibe lo que usa por parámetro, y todo se conecta en un punto (el *composition root*: `app.ts` y la ruta). | Se ve qué usa cada cosa leyendo su firma; no hay estado oculto, y testear es pasarle otra dependencia. |
| **D** | Una pregunta por capa | `domain`: ¿qué es y qué se le pide? `application`: ¿qué reglas se cumplen? `infrastructure`: ¿cómo se guarda? Ruta: ¿cómo se pide por HTTP y quién puede? Angular: ¿cómo lo usa una persona? | Cada cambio de requisito cae en una sola capa y se sabe dónde buscar. |
| **E** | El backend es la autoridad | Validar y autorizar es trabajo del backend. Lo que hace el frontend es ayuda para el usuario. | Cualquiera puede llamar la API sin pasar por la pantalla. |
| **F** | Un solo contrato con los clientes | Mismo formato de errores, tipos que reflejan los del backend, endpoints anotados en `API_CONTRACT.md`. | La misma API la usan tres clientes (admin-site, ecommerce, mobile). |
| **G** | Frontend en `core/` + `features/` | Lo transversal (cliente HTTP, sesión, interceptor) en `core/`; cada feature autocontenida en su carpeta. Los componentes no hablan HTTP. | Las features no se pisan entre sí y se cargan por separado. |

Por la regla A, el trabajo va **de adentro hacia afuera**: cada paso solo
usa lo que dejó listo el anterior, y nunca al revés.

## Paso 0: preparar el entorno

MySQL local con el seed, y `pnpm dev`.

**Por qué:** los paquetes de `packages/` se compilan aparte del backend
(consecuencia de A: son librerías independientes, no carpetas del backend).
`pnpm dev` los recompila al guardar; sin eso, los cambios no llegan. El
seed trae IDs fijos para probar, y Aiven es compartida: ahí no se prueban
escrituras.

## Parte 1: el backend por dentro ([1-BACKEND-CAPAS.md](1-BACKEND-CAPAS.md))

**Paso 1, domain: entidad, DTO, puerto y error.**
*Principios A, B y D.* Domain es el centro: define qué es una categoría
(entidad), qué datos se aceptan (DTO con zod), qué se le puede pedir a la
persistencia (interfaz del repositorio) y qué puede salir mal en términos del
negocio (`CategoriaError`). No importa Drizzle ni Fastify, porque todo lo
demás depende de él (A). La interfaz es el **puerto** (B): dice qué se
necesita (`obtener`, `actualizar`…) pero no cómo se hace. El error dice
"slug duplicado" y no "errno 1062", porque domain no sabe que existe MySQL
(D). El DTO vive acá para que la ruta y el caso de uso validen con las
mismas reglas sin duplicarlas.

**Paso 2, application: un caso de uso por operación.**
*Principios C y D.* Acá viven las reglas que no son de formato: el árbol de
categorías de 2 niveles, o que un proveedor solo edite lo suyo (D). Cada
caso de uso es una función que **recibe el repositorio por parámetro** (C).
Solo conoce la interfaz del paso 1, no la clase Drizzle. Si importara
`infrastructure`, se rompería la regla A y no se podría testear sin una
base real.

**Paso 3, infrastructure: el repositorio Drizzle.**
*Principios B y A.* Es el **adaptador** (B): la clase que implementa el
puerto del paso 1 con SQL real. Es el único lugar del sistema que sabe que
hay MySQL, así que un cambio de tabla o de ORM se queda acá. Depende de
domain (implementa su interfaz y lanza sus errores), y domain no depende de
ella: la flecha apunta hacia adentro (A). Por eso traduce los errores de
MySQL a errores de dominio antes de que suban.

**Paso 4, test del repositorio.**
*Principio B.* Como el adaptador está aislado detrás del puerto, se puede
probar solo, contra el MySQL local y sin HTTP. Si falla, el problema está
en el SQL y no en otra capa. Cada test corre en una transacción que se
revierte, así que la base queda como estaba.

## Parte 2: la API ([2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md))

**Paso 5, una ruta por operación.**
*Principios C, D y E.* La ruta es el **composition root** de cada request
(C): toma la conexión (`request.server.db`), arma el repositorio concreto y
se lo pasa al caso de uso. Es el único lugar donde se juntan
`infrastructure` y `application`. Su pregunta es solo "¿cómo se pide esto
por HTTP?" (D): valida la entrada, llama, traduce el resultado a un status.
Si tuviera reglas de negocio, cambiar de Fastify a Express (KAN-169)
obligaría a reescribirlas. La auth va en la misma ruta (`preHandler`), y la
organización se toma **del token, nunca del body** (E). Si no, cualquiera
editaría lo de otro mandando otro ID.

**Paso 6, errores 400, 404 y 409.**
*Principios F y D.* Las capas de adentro avisan en su idioma (`null`, un
error de dominio, un `ZodError`), y la capa HTTP los convierte en un status
(D). Todos salen con la misma forma, `{ "error": { "code", "message" } }`
(F), para que los tres clientes los manejen en un solo lugar. Hoy un body
inválido sale como 500: se arregla una vez en `app.ts`, que es donde se
centraliza el manejo de errores.

**Paso 7, probar con `curl`.**
*Principio E.* La API tiene que estar correcta por sí sola, sin ninguna
pantalla. Probarla así confirma que las validaciones y los permisos están
en el backend y no dependen del frontend. Además, si después falla la
pantalla, el problema queda acotado al frontend.

## Parte 3: la base del frontend ([3-FRONTEND-BASE.md](3-FRONTEND-BASE.md))

**Paso 8, completar `ApiClient`.**
*Principio G.* Es infraestructura del frontend, por eso va en `core/`: una
sola pieza conoce la URL base, que cambia entre desarrollo
(`localhost:8000`) y producción (`/api`). El helper `mensajeDeError` lee el
formato del paso 6 (F) en un solo lugar.

**Paso 9, mandar el token.**
*Principios G y C.* El interceptor agrega el header a todos los requests
desde `core/`, así ninguna feature se encarga de la auth. Cuando exista el
login, solo cambia de dónde sale el token, y las features no se tocan.

**Paso 10, modelo y servicio.**
*Principios F y G.* El modelo refleja la entidad del backend (F): es el
contrato tipado de lo que devuelve la API. El servicio es el único de la
feature que conoce las URLs (G), así que los componentes piden "dame las
categorías" sin saber de HTTP. Es la misma separación del backend, en
chico: la pantalla (presentación) no sabe cómo llegan los datos.

## Parte 4: las pantallas ([4-FRONTEND-PANTALLAS.md](4-FRONTEND-PANTALLAS.md))

**Paso 11, rutas, lista y formulario.**
*Principios G y E.* La feature se registra con carga diferida (lazy): es
una unidad autocontenida que se descarga solo cuando se entra a ella (G).
Un mismo formulario sirve para crear y editar. Sus validadores son ayuda
para el usuario; la validación que vale es la del backend (E), y el
formulario muestra el mensaje que llega de ahí.

**Paso 12, test del servicio.**
*Principio G.* Como solo el servicio habla HTTP, basta con interceptar sus
requests y revisar método y URL, sin levantar el backend.

**Paso 13, probarlo en el navegador.**
Es la prueba de que las piezas encajan: CORS, token, rutas y formato de
errores. Si los pasos 4, 7 y 12 pasaron, lo que falle acá es de unión entre
capas, no de una capa en particular.

## Paso 14: documentar

Entrada en `docs/cambios/`, el endpoint en `API_CONTRACT.md` si lo usa
mobile, y el estado del ticket en `docs/epicas/`.

**Por qué:** el contrato (F) también se mantiene por escrito, porque mobile
programa contra él. Y quien venga después no tiene el historial de esta
conversación ni de git.

## Qué archivos se tocan, de un vistazo

| Paso | Capa | Archivos (para `categoria`) |
|---|---|---|
| 1 | domain | `packages/domain/src/{entities,dtos,repositories}/categoria.*` |
| 2 | application | `packages/application/src/use-cases/{obtener,actualizar,eliminar}-categoria.use-case.ts` |
| 3–4 | infrastructure | `packages/infrastructure/src/repositories/categoria.repository.ts`, `test/categoria.repository.test.ts` |
| 5–6 | backend | `apps/backend/src/routes/categorias/{get,update,delete,index}.ts`, `src/lib/params.ts`, `src/server/app.ts` |
| 8–9 | frontend `core/` | `apps/admin-site/src/app/core/{api,auth,state}/`, `app.config.ts` |
| 10–12 | frontend `features/` | `apps/admin-site/src/app/features/categorias/`, `app.routes.ts` |
| 14 | docs | `docs/cambios/`, `apps/mobile/API_CONTRACT.md`, `docs/epicas/` |

En cada paso de `packages/`, exportar en el `index.ts` de la carpeta: cada
capa es un paquete y solo expone lo que exporta.
