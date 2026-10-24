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

## 4. Dónde viven imágenes y documentos

**Aplica en:** KAN-157 (y KAN-150, documentos del proveedor)

Disco del droplet (volumen Docker, respaldado junto con la base) o DO
Spaces. Si se implementa detrás de un puerto en `domain`, cambiarlo después
es escribir otro adaptador, sin tocar casos de uso.

## 5. Dominio y HTTPS

**Aplica en:** KAN-159

Let's Encrypt con Certbot necesita un dominio apuntando al droplet.
`APP_DOMAIN` ya está en `infra/.env` y la config de Nginx es plantilla, así
que falta definir el dominio y cómo se renuevan los certificados (contenedor
certbot o en el host).

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
