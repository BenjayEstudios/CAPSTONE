# Tareas pendientes - Jira (proyecto KAN)

Fuente: Jira `samuelarcon40.atlassian.net` - asignadas a Sebastian. Extraido el 2026-10-23; **estado de Jira reverificado el 2026-10-24 (coincide con este archivo: 22 Finalizadas, 4 En curso, 1 Por hacer)**.
Marcar `[x]` al completar cada tarea. Copias de versiones anteriores en `borradores/`.

## Resumen

| Estado (Jira) | Clave | Tipo | Prioridad | Titulo |
|---|---|---|---|---|
| En curso | KAN-150 | Historia | Highest | [API] Proveedores: perfil, cobertura, retiro y documentos |
| En curso | KAN-155 | Historia | Medium | [API] Auditoría y moderación automáticas |
| En curso | KAN-156 | Historia | Medium | [API] Correos transaccionales |
| En curso | KAN-173 | Tarea | Highest | [Docs] Diario de Reflexión Fase 2 - Sebastián |
| Por hacer | KAN-148 | Historia | Highest | [Pagos] Integración con pasarela (Webpay/MercadoPago sandbox) |
| Finalizado | KAN-112 | Historia | Highest | [Admin] Acceso al panel de administración |
| Finalizado | KAN-113 | Historia | High | [Admin] Dashboard estado de la plataforma |
| Finalizado | KAN-114 | Historia | Highest | [Admin] Cola de moderación |
| Finalizado | KAN-115 | Historia | Highest | [Admin] Aprobación y suspensión de proveedores |
| Finalizado | KAN-116 | Historia | Highest | [Admin] Catálogo maestro: listado |
| Finalizado | KAN-117 | Historia | Highest | [Admin] Crear y editar ficha de producto |
| Finalizado | KAN-118 | Historia | High | [Admin] Gestión de categorías |
| Finalizado | KAN-119 | Historia | High | [Admin] Órdenes de la plataforma |
| Finalizado | KAN-120 | Historia | Medium | [Admin] Reembolsos |
| Finalizado | KAN-121 | Historia | High | [Admin] Gestión de usuarios |
| Finalizado | KAN-122 | Historia | High | [Admin] Roles y permisos (matriz) |
| Finalizado | KAN-123 | Historia | High | [Admin] Liquidaciones a proveedores |
| Finalizado | KAN-124 | Historia | Medium | [Admin] Registro de auditoría |
| Finalizado | KAN-147 | Historia | Highest | [API] Carro y creación de orden con split por proveedor |
| Finalizado | KAN-149 | Historia | Highest | [API] Órdenes y estados de envío |
| Finalizado | KAN-151 | Historia | High | [API] Usuarios, roles y permisos |
| Finalizado | KAN-152 | Historia | High | [API] Liquidaciones semanales |
| Finalizado | KAN-153 | Historia | Medium | [API] Documentos tributarios simulados (SII) |
| Finalizado | KAN-154 | Historia | High | [API] Ingesta de eventos analíticos |
| Finalizado | KAN-166 | Historia | High | [Admin-site] Estructura base de la app |
| Finalizado | KAN-167 | Historia | High | [Admin-site] Shell y navegación del panel |
| Finalizado | KAN-169 | Tarea | Medium | [Backend] Decidir Fastify vs Express |

Reasignadas, ya NO son tuyas (Jira, 2026-10-24):

| Clave | Titulo | Ahora de | Estado |
|---|---|---|---|
| KAN-146 | [API] Ofertas del proveedor | Benjamín González | En curso |
| KAN-176 | [Docs] 2.4 Desarrollo Proyecto - Secc. 3 | Samuel Alarcon | En revisión |
| KAN-178 | [Docs] 2.6 Informe Final - Secc. 3 y 4 | Samuel Alarcon | En revisión |
| KAN-186 | [Diseño] 7. Planilla de casos de prueba | Samuel Alarcon | En revisión |
| KAN-187 | [Diseño] 8. Documentación de la metodología | Samuel Alarcon | En revisión |

## Avance local (2026-10-24, ~06:10 Chile)

Todo el codigo esta en la rama `dev-sebamax`, **solo en tu repositorio local** (nada subido a `origin`; lo subes tu). Jira ya refleja el avance. 22 historias tuyas figuran Finalizadas (codigo + pruebas automaticas y de API; el recorrido de cada pantalla en el navegador lo confirmas tu).

| Clave | Estado | Falta |
|---|---|---|
| KAN-150 | En curso | Lado proveedor (perfil, cobertura, retiro, subida de documentos, job de vencimiento) |
| KAN-155 | En curso | Conectar `abrirCasoModeracion` a alta de proveedor, precio fuera de rango y reembolso |
| KAN-156 | En curso | Disparadores de compra/nueva orden (KAN-148), recuperacion de contraseña, SMTP real |
| KAN-148 | Por hacer (bloqueada) | Decidir Webpay o MercadoPago y credenciales sandbox; agregar `pendiente` al enum estado_pago |
| KAN-173 | En curso | Tu diario (guia en `diario-preguntas.md`) |

Decisiones tuyas pendientes: pasarela de pago (KAN-148), `ver_auditoria` en nivel total, marca (CompraMejor/Cotizapp), tipografia, SMTP. Ver `estado-de-sesion.md`.

## En curso

### [ ] KAN-150 - [API] Proveedores: perfil, cobertura, retiro y documentos

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-150

Endpoints de gestión del proveedor y de su aprobación.

**Criterios de aceptación:**

* Perfil (columnas de proveedor en organizacion)
* CRUD de proveedor_cobertura y punto_retiro
* Subida de documentos con vencimiento y job que marca por_vencer/vencido
* Aprobar/suspender proveedor (admin)

**Fuente:** Casos de uso 'Gestionar cobertura' y 'Aprobar proveedor'

**Notas de avance:**

- 2026-10-24: Jira En curso. Lado admin hecho (API + pantalla KAN-115). PENDIENTE lado proveedor: perfil, cobertura, punto de retiro, subida de documentos por el proveedor y job por_vencer/vencido; al registrarse un proveedor, abrir caso de moderación alta_proveedor. La tabla proveedor_cobertura está vacía: sin cobertura ninguna compra puede confirmarse (409 SIN_COBERTURA).

### [ ] KAN-155 - [API] Auditoría y moderación automáticas

- **Tipo:** Historia | **Prioridad:** Medium | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-155

Registro transversal de acciones sensibles.

**Criterios de aceptación:**

* Hook que escribe en auditoria_log en aprobar, suspender, reembolsar, editar ficha y cambiar permisos
* Creación automática de casos de moderación (alta de proveedor, precio fuera de rango, reembolso)
* Endpoints de consulta

**Fuente:** dbDiagram (auditoria_log, moderacion_caso)

**Notas de avance:**

- 2026-10-24: Jira En curso. Auditoría de aprobar/suspender/reembolsar/editar ficha/cambiar permisos y endpoints de consulta listos. PENDIENTE: que algo llame a abrirCasoModeracion (alta de proveedor, precio fuera de rango (ofertas de Benjamín), reembolso).
-

### [ ] KAN-156 - [API] Correos transaccionales

- **Tipo:** Historia | **Prioridad:** Medium | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-156

Envío de correos del sistema.

**Criterios de aceptación:**

* Invitación de usuario y recuperación de contraseña
* Confirmación de compra con folio
* Aviso al proveedor de una nueva orden

**Fuente:** Mockup Administrador (Enviar invitación por correo)

**Notas de avance:**

- 2026-10-24: Jira En curso. Puerto de correo + adaptadores consola/SMTP/memoria y 5 plantillas; ya se envían la invitación y el código 2FA. PENDIENTE: disparadores de confirmación de compra y aviso al proveedor (dependen de KAN-148), flujo de recuperación de contraseña y servidor SMTP real.
-

### [ ] KAN-173 - [Docs] Diario de Reflexión Fase 2 - Sebastián

- **Tipo:** Tarea | **Prioridad:** Highest | **Etiquetas:** Evaluacion2
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-173

Drive: Fase 2 > 1.Evidencias Individuales > Sebastian_Ramirez_2.1_APT122_DiarioReflexionFase2.docx

Completar el diario de reflexión individual.

**Notas de avance:**

-

## Por hacer

### [ ] KAN-148 - [Pagos] Integración con pasarela (Webpay/MercadoPago sandbox)

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** backend, pagos, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-148

Cobro único de la orden en la pasarela.

**Criterios de aceptación:**

* Inicia la transacción y redirige al cliente
* Confirma por callback/webhook y actualiza estado_pago, referencia_pasarela y pagado_en
* Maneja pago fallido y anulado
* Credenciales sandbox fuera del repo (env)

**Fuente:** Guía Fase 1 obj. 4; Caso de uso 'Procesar pago'

**Notas de avance:**

-

## Finalizadas (Jira: Finalizado, 2026-10-24)

### [x] KAN-112 - [Admin] Acceso al panel de administración

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-112

Login para usuarios internos con control por rol y segundo factor.

**Criterios de aceptación:**

* Solo entran usuarios de organizaciones tipo interna
* Exige 2FA cuando el usuario tiene mfa_estado = activo
* El menú muestra solo las secciones que permite la matriz de permisos del rol

**Fuente:** Mockup Administrador; dbDiagram (usuario.mfa_estado, rol.permisos)

**Notas de avance:**

- 2026-10-24: Jira Finalizado. Login backend (POST /auth/admin/login, GET /auth/me; solo org interna), pantalla /login y segundo paso de 2FA por correo implementados (921c8ba / 8cab0ad; ya no existe el stub MFA_NO_IMPLEMENTADO). Pendiente: prueba en navegador con cuenta admin.

### [x] KAN-113 - [Admin] Dashboard estado de la plataforma

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-113

Resumen general de la operación.

**Criterios de aceptación:**

* KPIs del mes (órdenes del cliente, monto transado, comisión, proveedores activos)
* Gráfico de monto transado por semana
* Proveedores por volumen (SKU, órdenes, monto)
* Salud del catálogo (fichas sin imagen, sin ofertas, duplicadas)

**Fuente:** Mockup Administrador

**Notas de avance:**

-

### [x] KAN-114 - [Admin] Cola de moderación

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-114

Bandeja de casos pendientes del administrador.

**Criterios de aceptación:**

* Lista los casos alta_proveedor, ficha_duplicada, precio_fuera_rango y reembolso
* Asignar caso, revisar, resolver o descartar
* Cada resolución queda en auditoria_log

**Fuente:** Mockup Administrador; dbDiagram (moderacion_caso)

**Notas de avance:**

-

### [x] KAN-115 - [Admin] Aprobación y suspensión de proveedores

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-115

Revisar los documentos y aprobar o suspender proveedores.

**Criterios de aceptación:**

* Ver los datos legales y documentos del proveedor
* Marcar cada documento como revisado (revisado_por)
* Aprobar (activa), rechazar o suspender (suspendida) la organización
* Asignar el % de comisión al aprobar

**Fuente:** Caso de uso 'Aprobar proveedor'

**Notas de avance:**

- 2026-10-24: codigo listo (24b5063): listado + detalle con revision de documentos (aprobar/rechazar con motivo) y aprobar/rechazar/suspender proveedor, confirmacion en dos pasos. API lista (KAN-150 admin). `ng build` y 49 tests OK; servidor en :4300 responde. Pendiente: prueba en navegador.

### [x] KAN-116 - [Admin] Catálogo maestro: listado

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-116

Vista de todas las fichas de producto.

**Criterios de aceptación:**

* Tabla: producto, SKU, categoría, formato, n.º de proveedores, precio desde, imágenes, estado
* Filtros por estado y categoría; búsqueda por nombre/SKU/EAN

**Fuente:** Mockup Administrador; Caso de uso 'Moderar catálogo'

**Notas de avance:**

- 2026-10-24: API (dcc01a6) y pantalla de listado (3504e10) listas: tabla, filtros estado/categoria, busqueda, paginacion. Pendiente: prueba en navegador.

### [x] KAN-117 - [Admin] Crear y editar ficha de producto

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-117

Formulario de la ficha única y compartida. Solo la administración crea productos.

**Criterios de aceptación:**

* Campos: nombre, SKU, EAN, categoría y subcategoría, marca, formato, contenido, unidad, descripción
* Galería de imágenes (JPG/PNG, mínimo 1200 px), una marcada como principal
* Reglas: precio de referencia y tope de publicación sobre la referencia (%)
* Publicar en el catálogo o guardar como borrador

**Fuente:** Mockup Administrador; dbDiagram (producto)

**Notas de avance:**

- 2026-10-24: API (dcc01a6, 6494967) y ficha de producto (d1df6e2) listas: formulario, galeria con subida local de imagenes, borrador/publicar. Pendiente: prueba en navegador. Storage en Spaces solo en produccion (puerto AlmacenArchivos listo).

### [x] KAN-118 - [Admin] Gestión de categorías

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-118

Mantener el árbol de categorías de dos niveles.

**Criterios de aceptación:**

* CRUD de categorías nivel 1 y 2 (padre_id)
* Ordenar y ocultar categorías
* El slug es único

**Fuente:** Caso de uso 'Moderar catálogo'; Minuta 001

**Notas de avance:**

- 2026-10-24: API (dcc01a6) y pantalla (3504e10) listas: arbol de 2 niveles, crear/editar, ocultar, ordenar, slug unico. Pendiente: prueba en navegador. Duda de diseno: si ocultar un padre debe reflejarse en sus hijas en la UI.

### [x] KAN-119 - [Admin] Órdenes de la plataforma

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-119

Vista de cada orden del cliente con los envíos de cada proveedor debajo.

**Criterios de aceptación:**

* Lista con folio, cliente, comuna, fecha, medio de pago, estado y monto
* Detalle: envíos por proveedor con líneas, plazo, estado y monto
* Muestra la comisión de CompraMejor y el monto a liquidar a proveedores
* Filtros por estado

**Fuente:** Mockup Administrador

**Notas de avance:**

-

### [x] KAN-120 - [Admin] Reembolsos

- **Tipo:** Historia | **Prioridad:** Medium | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-120

Emitir un reembolso total o parcial de una orden.

**Criterios de aceptación:**

* Requiere el permiso emitir_reembolso
* Genera nota de crédito (DTE 61) y marca el pago como reembolsado
* Queda en auditoria_log con los datos antes y después

**Fuente:** dbDiagram (orden.estado_pago, documento_tributario, auditoria_accion)

**Notas de avance:**

-

### [x] KAN-121 - [Admin] Gestión de usuarios

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-121

Alta, edición y suspensión de usuarios.

**Criterios de aceptación:**

* Tabla: usuario, rol, organización, último acceso, 2FA, estado
* Crear usuario con invitación por correo o contraseña temporal
* Asociar a una organización y rol; exigir 2FA o dejarlo opcional
* Editar y suspender

**Fuente:** Mockup Administrador; Caso de uso 'Gestionar roles'

**Notas de avance:**

-

### [x] KAN-122 - [Admin] Roles y permisos (matriz)

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-122

Matriz editable rol × permiso.

**Criterios de aceptación:**

* Filas: permisos del catálogo (crear_producto, aprobar_proveedor, emitir_reembolso, liquidar_proveedor, cambiar_permisos, ver_auditoria, etc.)
* Columnas: roles, con el n.º de usuarios afectados
* Nivel por celda: ninguno / parcial / total
* Guardar o restablecer; el cambio queda en auditoría

**Fuente:** Mockup Administrador; dbDiagram (rol.permisos)

**Notas de avance:**

-

### [x] KAN-123 - [Admin] Liquidaciones a proveedores

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-123

Gestión de los cortes semanales (actor: Encargado de liquidaciones).

**Criterios de aceptación:**

* Ver los cortes generados por proveedor y período
* Detalle con los envíos incluidos, bruto, comisión y neto
* Marcar como pagada con fecha
* Requiere el permiso liquidar_proveedor

**Fuente:** Minuta 001 (actor Encargado de liquidaciones); dbDiagram (liquidacion)

**Notas de avance:**

-

### [x] KAN-124 - [Admin] Registro de auditoría

- **Tipo:** Historia | **Prioridad:** Medium | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-124

Consulta del log de acciones sensibles.

**Criterios de aceptación:**

* Filtros por entidad, acción, usuario y rango de fechas
* Ver el diff de datos antes/después
* Requiere el permiso ver_auditoria

**Fuente:** Mockup Administrador; dbDiagram (auditoria_log)

**Notas de avance:**

-

### [x] KAN-147 - [API] Carro y creación de orden con split por proveedor

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-147

Carro persistente y conversión a orden.

**Criterios de aceptación:**

* Carro con items JSON y precio_visto
* Al confirmar: crea la orden y un orden_envio por proveedor con líneas congeladas (nombre, formato, precio)
* Calcula despacho por cobertura, comisión por proveedor y totales
* Descuenta el stock en cajas de cada oferta

**Fuente:** Guía Fase 1 obj. 4 y 5 (split simulado)

**Notas de avance:**

-

### [x] KAN-149 - [API] Órdenes y estados de envío

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-149

Consulta de órdenes por perfil y máquina de estados de los envíos.

**Criterios de aceptación:**

* Cliente: sus órdenes; proveedor: solo sus orden_envio; admin: todas
* Transiciones válidas del envío y recálculo del estado de la orden
* Actualiza entregas_a_tiempo_pct del proveedor al entregar

**Fuente:** dbDiagram (orden, orden_envio)

**Notas de avance:**

-

### [x] KAN-151 - [API] Usuarios, roles y permisos

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-151

Endpoints de administración de usuarios.

**Criterios de aceptación:**

* CRUD de usuarios con invitación por correo
* Lectura y escritura de la matriz rol.permisos (permisos_actualizado_por/en)

**Fuente:** Caso de uso 'Gestionar roles'

**Notas de avance:**

-

### [x] KAN-152 - [API] Liquidaciones semanales

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-152

Corte semanal automático por proveedor.

**Criterios de aceptación:**

* Job que agrupa los envíos entregados de la semana anterior por proveedor y genera la liquidación
* Llena los montos liquidados en orden_envio
* Endpoint para marcar como pagada

**Fuente:** Caso de uso 'Ver liquidaciones'; dbDiagram (liquidacion)

**Notas de avance:**

-

### [x] KAN-153 - [API] Documentos tributarios simulados (SII)

- **Tipo:** Historia | **Prioridad:** Medium | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-153

Emisión simulada de DTE. La integración real con el SII queda fuera del MVP.

**Criterios de aceptación:**

* Boleta (39) o factura (33) por orden; guía de despacho (52) por envío; nota de crédito (61) en reembolsos
* Folio único por (tipo, folio, emisor) y estado_sii simulado
* Genera un PDF descargable

**Fuente:** Caso de uso 'Emitir DTE'; Minuta 001 (SII puede quedar simulado)

**Notas de avance:**

-

### [x] KAN-154 - [API] Ingesta de eventos analíticos

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-154

Registro de vistas, clicks y búsquedas desde web y mobile.

**Criterios de aceptación:**

* Endpoint liviano que acepta vista_producto, click_oferta y busqueda con sesion_id
* Funciona para usuarios anónimos
* Endpoints de estadísticas para los paneles

**Fuente:** dbDiagram (evento_analitico)

**Notas de avance:**

-

### [x] KAN-166 - [Admin-site] Estructura base de la app

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-166

Proyecto Angular de apps/admin-site listo para desarrollar, igual que ya existe para apps/ecommerce.

**Criterios de aceptación:**

* Rutas standalone con guards de rol administrador
* Cliente HTTP (ApiClient) apuntando a apps/backend
* Estado de sesión del administrador
* Build de producción funcionando (ng build)

**Fuente:** apps/admin-site/README.md

**Notas de avance:**

- 2026-10-24: codigo listo y commiteado en dev-sebamax (c03f5ca): rutas lazy, guards (adminGuard/permisoGuard), ApiClient, estado de sesion, interceptor. `ng build` y 39 tests OK. Pendiente: probar en navegador contra el backend real.

### [x] KAN-167 - [Admin-site] Shell y navegación del panel

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-167

Layout compartido del panel de administración: barra lateral de navegación entre módulos, header con usuario/rol activo y logout.

**Criterios de aceptación:**

* Sidebar con los módulos habilitados según el rol
* Header con nombre del usuario, rol y acción de cerrar sesión
* Estado 'cargando' y manejo de sesión expirada (redirige a login)

**Fuente:** Mockup Administrador (estructura general); docs/ARCHITECTURE.md (apps/admin-site)

**Notas de avance:**

- 2026-10-24: codigo listo (c03f5ca): sidebar filtrado por permisos, header con usuario/rol/logout, estado 'validando sesion', redireccion por sesion expirada. Pendiente: prueba en navegador.

### [x] KAN-169 - [Backend] Decidir Fastify vs Express

- **Tipo:** Tarea | **Prioridad:** Medium | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-169

Dos de los tres integrantes del equipo conocen Express y no Fastify. Evaluar si conviene migrar apps/backend de Fastify a Express antes de que haya más rutas implementadas (hoy solo existe el ejemplo end-to-end de 'categoria').

**Criterios de aceptación:**

* Decisión documentada en docs/ARCHITECTURE.md (quedarse en Fastify o migrar a Express) con la razón
* Si se migra: plan de migración de apps/backend/src/{server,routes,plugins,types} (domain/application/infrastructure no se tocan, ya están aislados del framework HTTP)
* Si no se migra: plan de onboarding/documentación para que el resto del equipo pueda trabajar en Fastify

**Fuente:** Conversación de equipo sobre stack conocido (Express) vs Fastify actual

**Notas de avance:**

- 2026-10-24: Jira Finalizado, pero en el repo NO hay decision documentada: docs/ARCHITECTURE.md solo describe Fastify como stack, sin la razon de quedarse ni plan de onboarding (criterio de aceptacion). Se sigue con Fastify. Revisar si falta escribir ese apartado.
