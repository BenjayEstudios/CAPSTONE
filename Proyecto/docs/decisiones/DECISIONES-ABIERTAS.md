# Decisiones abiertas

Lo que falta resolver. Ninguna bloquea el trabajo en curso salvo donde se diga.

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

## 8. Automatizar `db:particiones`

**Aplica en:** KAN-143 / KAN-163

`pnpm db:particiones` hay que correrlo una vez al mes en cada base. Si nadie
lo hace no se pierden datos (caen en `pmax`), pero se pierde el pruning.
Desde KAN-161 el paso de migraciones de cada deploy también asegura las
particiones (mes actual + 3), pero los deploys no tienen fecha fija: falta la
corrida mensual garantizada. Opciones: cron en el droplet o job programado en
GitHub Actions (KAN-163).

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

El catálogo público (KAN-145) sigue la lectura del seed: el
`precioNormalizado` de cada oferta es `precio_unitario / contenido` (el
bidón de 5 L a $12.490 sale a $2.498 por litro). Si se decide que
`precio_unitario` es por caja, hay que dividir además por
`unidades_por_caja` en `precioNormalizado`
(`packages/application/src/use-cases/catalogo.use-cases.ts`).

## 13. Umbrales de las alertas del proveedor

**Aplica en:** el endpoint de alertas de KAN-137

Mobile propone (y su fake aplica) **stock bajo** = oferta publicada con 20
cajas o menos, y **documento por vencer** = vence en 45 días o menos
(`vencido` si ya pasó, calculado al consultar, no con la columna `estado`
del seed). Son números de partida: falta validarlos con el equipo, y decidir
si el umbral de stock debería ser relativo (por ejemplo, 25% de las cajas
iniciales).

## 14. Tecnología emergente que pide la rúbrica

**Aplica en:** informe final de Fase 2 · **Tickets:** por crear en Jira (KAN-88)

La rúbrica pide incorporar al menos una tecnología emergente (análisis
descriptivo/BI, data science, minería de datos, IA generativa, 3D, AR, IoT,
MLOps, GenAI en procesos de negocio, digital twins, blockchain, huella de
carbono; se pueden combinar). Propuesta (2026-11-19):

1. **BI con Metabase (punto a)** — infraestructura, Samuel. Un contenedor
   más del stack, con usuario MySQL de solo lectura y dashboards sobre lo que
   ya existe: las consultas de analítica de KAN-143 (ventas por semana, embudo
   vistas → clics → conversión, KPIs, búsquedas sin resultado) y
   `oferta_precio_historial`. El análisis descriptivo ya está en el código;
   Metabase lo hace reconocible como BI.
2. **Asistente de catálogo con IA generativa (puntos d + i)** — backend. A
   partir del texto libre con que un distribuidor describe un producto, un
   LLM propone nombre normalizado, categoría, marca, formato, unidad y
   descripción, y señala si ya existe un `producto` equivalente. Ataca el
   problema central de un comparador (el mismo producto con nombres
   distintos según el distribuidor). Solo sugiere: la persona confirma y se
   guarda por el `POST /productos` existente.
3. **Opcional, si sobra tiempo:** web scraping de precios públicos para
   alimentar `precio_referencia` (punto c; ojo con términos de uso y
   `robots.txt`), o estimación de huella de carbono del droplet (punto m).

**Descartado:** 3D, AR, Arduino/IoT, TinyML, digital twins y blockchain no
tienen relación con una plataforma B2B de cotización. ML predictivo (b, h) no
se puede validar en serio: los datos de órdenes y eventos son sintéticos.

**Falta decidir:**

- Confirmarlo con el equipo y crear los tickets en Jira.
- Proveedor y costo del LLM, y dónde vive la API key (secreto del droplet,
  nunca en el repo).
- Si Metabase cabe en la RAM del droplet (su JVM pide ~1 GB) o corre solo en
  local para la demo.

## 15. "Marca propia" en la búsqueda

**Aplica en:** KAN-91 (y la ficha de producto del proveedor)

KAN-91 pide refinar por "marca propia", pero el modelo no distingue si un
producto es la marca propia de un distribuidor: `producto.marca` es solo un
texto y el producto es único para todos los distribuidores. Hoy la búsqueda
ofrece **filtrar por marca** (con las marcas de los resultados). Para
"marca propia" de verdad haría falta, por ejemplo, `producto.marca_propia_de`
(id del proveedor dueño de la marca) o una marca por oferta. Falta decidir si
vale la pena para la demo.

## 16. Transferencia y línea de crédito en el checkout

**Aplica en:** KAN-95 (checkout), KAN-148 (pagos) · **Afecta:** paso 3 del pago en el ecommerce y la app

El checkout ofrece tarjeta (crédito, débito o prepago) por Webpay Plus. KAN-95
pide además transferencia bancaria y línea de crédito para empresas a 30
días, que hoy aparecen como "pronto disponible" y el backend responde
`409 MEDIO_PAGO_NO_DISPONIBLE`. Falta decidir:

- **Transferencia:** la orden quedaría `pendiente_pago` con los datos de la
  cuenta y el folio como glosa, y alguien (admin, o una conciliación) la
  marca pagada. No hay pantalla ni endpoint para eso.
- **Línea de crédito:** necesita quién la aprueba, con qué cupo y qué pasa
  con la orden mientras tanto (`estado_pago = autorizado` existe en el
  modelo). Sin eso no se puede ofrecer.

Relacionado: el paso 1 del mockup pide nombre, RUT, correo y teléfono, pero
`POST /carro/confirmar` no los recibe; la boleta o factura sale con los datos
de la organización. El checkout los muestra desde la cuenta en vez de
pedirlos. Si un comprador necesita facturar a otro RUT, hay que agregarlo al
schema.

## 17. Tipo de cliente (empresa, persona o institución)

**Aplica en:** KAN-106 (tus clientes) · **Afecta:** la columna "Tipo" del panel del proveedor

El mockup del proveedor muestra si cada cliente es empresa, persona o
institución, pero `organizacion` no guarda ese dato y el registro no lo
pregunta. Hoy se deduce del RUT y del giro (`tipoCliente` en
`ordenes.use-cases.ts`):

- RUT entre 60.000.000 y 69.999.999 (organismos públicos, corporaciones y
  fundaciones): institución.
- RUT bajo 50.000.000 sin giro: persona.
- Todo lo demás: empresa. Una persona natural con giro (un minimarket) cuenta
  como empresa, como en el mockup.

Falta decidir si basta con eso o si se agrega una columna `tipo_cliente` a
`organizacion` que el comprador elija al registrarse. Eso necesita una
migración y un campo en el registro (KAN-89).

## 18. Representante legal y contacto de operaciones del proveedor

**Aplica en:** KAN-108 (perfil de empresa) · **Afecta:** `organizacion` y el registro de proveedores (KAN-100)

El mockup del perfil pide representante legal (nombre y RUT) y un contacto de
operaciones con su teléfono. `organizacion` no tiene esas columnas. Hoy el
perfil muestra como contacto de operaciones a los usuarios activos de la
empresa, que son quienes reciben los avisos de órdenes, y no muestra al
representante legal.

Falta decidir si se agregan las columnas `representante_nombre`,
`representante_rut`, `contacto_operaciones` y `telefono_operaciones` a
`organizacion`. Eso necesita una migración, que se aplicaría en Aiven con el
deploy. El representante también podría pedirse en el alta del proveedor,
junto con sus documentos.
