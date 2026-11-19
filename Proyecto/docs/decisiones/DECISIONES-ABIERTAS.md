# Decisiones abiertas

Lo que falta resolver. Ninguna bloquea el trabajo en curso salvo donde se diga.

## 1. Código del rol administrador en `POST /categorias`

**Aplica en:** KAN-144 / KAN-151 (API)

`POST /categorias` exige `requireRol("administrador")`, pero en el seed el
código del rol es `admin_general` (los internos son `admin_general`,
`editor_catalogo` y `soporte`). Con el seed, nadie puede crear categorías.

Hay que decidir si la ruta pide `admin_general` (o también
`editor_catalogo`, que suena a dueño natural del catálogo) y alinear el
ejemplo de referencia del README. KAN-144 pide además que `requireRol` pase
a leer la matriz `rol.permisos` en vez de comparar códigos de rol a mano,
lo que resolvería esto de raíz.

**Bloquea:** que admin-site pueda gestionar categorías (KAN-118).

## 2. Fastify vs Express

**Aplica en:** KAN-169 — conviene resolverlo **antes** de que entre más API

Dos de los tres integrantes conocen Express y no Fastify. El ticket pide
evaluar si conviene migrar `apps/backend` ahora, cuando solo existe el
ejemplo de `categoria`, y documentar la decisión con su razón. Si no se
migra, hace falta un plan de onboarding para trabajar en Fastify.

A favor de quedarse: el patrón de rutas (`RouteOptions`), los `preHandler`
de auth, el composition root y la validación de entorno ya están hechos y
documentados sobre Fastify.

**Bloquea:** el arranque de los tickets de API (KAN-144 a KAN-156).

## 3. Pasarela de pago

**Aplica en:** KAN-148

Webpay o MercadoPago, ambas en sandbox. Ya está decidido que el split entre
proveedores es simulado en la base propia (ver
[cerradas](DECISIONES-CERRADAS.md)); falta elegir la pasarela.

## 5. Dominio y HTTPS

**Aplica en:** KAN-159

Let's Encrypt con Certbot necesita un dominio apuntando al droplet.
`APP_DOMAIN` y `ADMIN_DOMAIN` ya están en `infra/.env` y la config de Nginx
es plantilla, así que falta definir el dominio y cómo se renuevan los
certificados (contenedor certbot o en el host).

**Ojo con las imágenes ya subidas**: `producto.imagenes` guarda la URL
**absoluta** (`http://<APP_DOMAIN>/uploads/...`, armada con
`PUBLIC_BASE_URL`). Si cambia el dominio (de nip.io al definitivo) o el
esquema (`http` → `https`), esas URL quedan rotas. O se define dominio y
HTTPS antes de cargar datos reales, o el backend pasa a guardar la ruta
relativa/clave y arma la URL al leer (ver
[cambio de KAN-157](../cambios/2026-11-18-almacenamiento-de-archivos-en-volumen.md)).

## 6. Destino de los respaldos

**Aplica en:** KAN-160

Ya está decidido que son `mysqldump` programados con copia fuera del
droplet. Falta el destino (Spaces, otro proveedor, máquina del equipo), la
retención y probar una restauración end-to-end.

## 7. Imágenes construidas en el runner o en el droplet

**Aplica en:** KAN-161

Hoy el deploy hace `up -d --build` en el droplet. Lo previsto es construir en
GitHub Actions y publicar en GHCR para que el droplet no compile (un
`ng build` puede quedarse sin RAM en un droplet chico). Falta implementarlo y
decidir cómo correr las migraciones de Drizzle en el deploy.

## 8. Automatizar `db:particiones`

**Aplica en:** KAN-143 / KAN-163

`pnpm db:particiones` hay que correrlo una vez al mes en cada base. Si nadie
lo hace no se pierden datos (caen en `pmax`), pero se pierde el pruning.
Opciones: cron en el droplet, paso del deploy, o job programado en GitHub
Actions.

## 9. Búsqueda sin stemming

**Aplica en:** KAN-145

El FULLTEXT de `producto.nombre` no hace stemming: "quesos" no encuentra
"Queso". La propuesta es `MATCH ... AGAINST('ques*' IN BOOLEAN MODE)`
(prefijo); falta confirmarla al implementar el endpoint. El fake de mobile
busca por subcadena sin tildes, así que puede haber diferencias.

## 10. Login de clientes y proveedores

**Aplica en:** KAN-144 · **Bloquea:** la integración real de mobile (KAN-87) y del ecommerce (KAN-85)

El único login es `POST /auth/admin/login`, que rechaza a quien no sea de la
organización interna. Sin un login para organizaciones `cliente` y
`proveedor`, nadie fuera del equipo obtiene token, y endpoints que ya existen
(`/carro`, `/ordenes`, `/estadisticas/proveedor`) no se pueden usar desde las
apps. La propuesta está en
[`apps/mobile/API_CONTRACT.md`](../../apps/mobile/API_CONTRACT.md#-post-authlogin--kan-126):
mismas reglas que `loginAdmin` sin exigir organización interna, y la misma
respuesta más el objeto `organizacion`. Falta decidir si es una ruta aparte o
`/auth/admin/login` generalizado.

## 11. Ruta del catálogo público

**Aplica en:** KAN-145 · **Afecta:** mobile (KAN-127 a 129) y ecommerce

`GET /productos` ya existe, pero es el listado de **administración** (exige
`crear_producto`, devuelve fichas sin ofertas ni precios). El comprador
necesita otro: público, con el rango de precios de las ofertas visibles y el
comparador con calificaciones. Mobile lo especificó como
`GET /catalogo/productos` y `GET /catalogo/productos/:id`
([contrato](../../apps/mobile/API_CONTRACT.md#-get-catalogoproductos--kan-127-kan-128));
el ecommerce debería usar los mismos. Falta confirmarlo con backend.

## 12. Unidad de `cantidad` y de `precio_unitario`

**Aplica en:** KAN-145, KAN-147 · **Afecta:** precios por kg/L, mínimos y stock en las tres apps

`planificarOrden` trata `cantidad` como **cajas** (la compara con
`cajas_disponibles`) y cobra `precio_unitario × cantidad`, es decir,
`precio_unitario` sería el precio **por caja**. Pero el mínimo de compra se
compara en unidades (`cantidad × unidades_por_caja`), el seed carga
`precio_unitario` como precio del formato ("Bidón 5 L a $12.490", igual que
`precio_referencia`) y el mockup del proveedor pide "precio por unidad" y
"unidades por caja". Con la regla actual, una caja de 4 bidones se cobra como
un bidón. Mobile sigue la matemática del backend (total = precio × cantidad)
y muestra "c/u" sin decir "caja" hasta que se decida. Hay que fijar qué es
cada campo y alinear seed, casos de uso y pantallas.

## 13. Umbrales de las alertas del proveedor

**Aplica en:** el endpoint de alertas de KAN-137

Mobile propone (y su fake aplica) **stock bajo** = oferta publicada con 20
cajas o menos, y **documento por vencer** = vence en 45 días o menos
(`vencido` si ya pasó, calculado al consultar, no con la columna `estado`
del seed). Son números de partida: falta validarlos con el equipo, y decidir
si el umbral de stock debería ser relativo (por ejemplo, 25% de las cajas
iniciales).
