# Tareas pendientes - Jira (proyecto KAN)

Fuente: Jira `samuelarcon40.atlassian.net` - asignadas a Sebastian, estado distinto de Finalizada. Extraido el 2026-10-23.
Marcar `[x]` al completar cada tarea.

## Resumen

| Estado | Clave | Tipo | Prioridad | Titulo |
|---|---|---|---|---|
| En curso | KAN-118 | Historia | High | [Admin] Gestión de categorías |
| En curso | KAN-117 | Historia | Highest | [Admin] Crear y editar ficha de producto |
| En curso | KAN-116 | Historia | Highest | [Admin] Catálogo maestro: listado |
| En curso | KAN-112 | Historia | Highest | [Admin] Acceso al panel de administración |
| En curso | KAN-167 | Historia | High | [Admin-site] Shell y navegación del panel |
| En curso | KAN-166 | Historia | High | [Admin-site] Estructura base de la app |
| En curso | KAN-169 | Tarea | Medium | [Backend] Decidir Fastify vs Express |
| En curso | KAN-173 | Tarea | Highest | [Docs] Diario de Reflexión Fase 2 - Sebastián |
| En curso | KAN-176 | Tarea | Highest | [Docs] 2.4 Desarrollo Proyecto - Secc. 3 Ajustes a partir del monitoreo |
| En curso | KAN-178 | Tarea | Highest | [Docs] 2.6 Informe Final - Secc. 3 Metodología y 4 Desarrollo |
| En curso | KAN-186 | Tarea | Highest | [Diseño] 7. Planilla de casos de prueba |
| En curso | KAN-187 | Tarea | Highest | [Diseño] 8. Documentación de la metodología |
| Por hacer | KAN-113 | Historia | High | [Admin] Dashboard estado de la plataforma |
| Por hacer | KAN-114 | Historia | Highest | [Admin] Cola de moderación |
| Por hacer | KAN-115 | Historia | Highest | [Admin] Aprobación y suspensión de proveedores |
| Por hacer | KAN-119 | Historia | High | [Admin] Órdenes de la plataforma |
| Por hacer | KAN-120 | Historia | Medium | [Admin] Reembolsos |
| Por hacer | KAN-121 | Historia | High | [Admin] Gestión de usuarios |
| Por hacer | KAN-122 | Historia | High | [Admin] Roles y permisos (matriz) |
| Por hacer | KAN-123 | Historia | High | [Admin] Liquidaciones a proveedores |
| Por hacer | KAN-124 | Historia | Medium | [Admin] Registro de auditoría |
| Por hacer | KAN-147 | Historia | Highest | [API] Carro y creación de orden con split por proveedor |
| Por hacer | KAN-148 | Historia | Highest | [Pagos] Integración con pasarela (Webpay/MercadoPago sandbox) |
| Por hacer | KAN-149 | Historia | Highest | [API] Órdenes y estados de envío |
| Por hacer | KAN-150 | Historia | Highest | [API] Proveedores: perfil, cobertura, retiro y documentos |
| Por hacer | KAN-151 | Historia | High | [API] Usuarios, roles y permisos |
| Por hacer | KAN-152 | Historia | High | [API] Liquidaciones semanales |
| Por hacer | KAN-153 | Historia | Medium | [API] Documentos tributarios simulados (SII) |
| Por hacer | KAN-154 | Historia | High | [API] Ingesta de eventos analíticos |
| Por hacer | KAN-155 | Historia | Medium | [API] Auditoría y moderación automáticas |
| Por hacer | KAN-156 | Historia | Medium | [API] Correos transaccionales |

## Avance local (2026-10-24)

Todo el codigo esta en la rama `dev-sebamax` (sin PR aun). Jira se consulto en solo lectura el 2026-10-24; nada se ha escrito en Jira. Ninguna tarea se marca `[x]` hasta probarla en el navegador.

| Clave | Avance | Falta |
|---|---|---|
| KAN-166 / 167 | Codigo listo | Prueba en navegador |
| KAN-112 | Parcial: login sin 2FA | 2FA + prueba |
| KAN-116 / 117 / 118 | Codigo listo (API + pantallas) | Prueba en navegador |
| KAN-150 | Parcial: lado admin | Lado proveedor y job de vencimiento |
| KAN-115 | Codigo listo | Prueba en navegador |
| KAN-169 | Sin decision | Decision del equipo |
| KAN-173 | Diario de reflexion: sigue tuyo (En curso en Jira) | Redactarlo tu; hay guia de preguntas pendiente |
| KAN-176, 178, 186, 187 | REASIGNADAS a Samuel Alarcon, En revision (Jira, 24 oct). Ya no son tuyas | Nada; borradores de apoyo en ApuntesSeba/borradores/ por si el equipo los quiere |
| KAN-146 | Benjamin Gonzalez, En curso (Jira, 24 oct; cambio hecho por Samuel). Fuera de tu plan | - |
| KAN-169 | Finalizado en Jira | Decision de fondo no verificada en docs/ARCHITECTURE.md (sigue diciendo Fastify) |

## En curso

### [ ] KAN-118 - [Admin] Gestión de categorías

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

### [ ] KAN-117 - [Admin] Crear y editar ficha de producto

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

### [ ] KAN-116 - [Admin] Catálogo maestro: listado

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-116

Vista de todas las fichas de producto.

**Criterios de aceptación:**

* Tabla: producto, SKU, categoría, formato, n.º de proveedores, precio desde, imágenes, estado
* Filtros por estado y categoría; búsqueda por nombre/SKU/EAN

**Fuente:** Mockup Administrador; Caso de uso 'Moderar catálogo'

**Notas de avance:**

- 2026-10-24: API (dcc01a6) y pantalla de listado (3504e10) listas: tabla, filtros estado/categoria, busqueda, paginacion. Pendiente: prueba en navegador.

### [ ] KAN-112 - [Admin] Acceso al panel de administración

- **Tipo:** Historia | **Prioridad:** Highest | **Etiquetas:** admin-site, frontend
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-112

Login para usuarios internos con control por rol y segundo factor.

**Criterios de aceptación:**

* Solo entran usuarios de organizaciones tipo interna
* Exige 2FA cuando el usuario tiene mfa_estado = activo
* El menú muestra solo las secciones que permite la matriz de permisos del rol

**Fuente:** Mockup Administrador; dbDiagram (usuario.mfa_estado, rol.permisos)

**Notas de avance:**

- 2026-10-24: PARCIAL. Login backend (POST /auth/admin/login, GET /auth/me; solo org interna) y pantalla /login listos (6bfb9ba, c03f5ca). FALTA el 2FA (hoy responde 403 MFA_NO_IMPLEMENTADO si mfa_estado='activo'): no cerrar la historia hasta implementarlo o acordar dejarlo fuera. Pendiente: prueba en navegador con cuenta admin.

### [ ] KAN-167 - [Admin-site] Shell y navegación del panel

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

### [ ] KAN-166 - [Admin-site] Estructura base de la app

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

### [ ] KAN-169 - [Backend] Decidir Fastify vs Express

- **Tipo:** Tarea | **Prioridad:** Medium | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-169

Dos de los tres integrantes del equipo conocen Express y no Fastify. Evaluar si conviene migrar apps/backend de Fastify a Express antes de que haya más rutas implementadas (hoy solo existe el ejemplo end-to-end de 'categoria').

**Criterios de aceptación:**

* Decisión documentada en docs/ARCHITECTURE.md (quedarse en Fastify o migrar a Express) con la razón
* Si se migra: plan de migración de apps/backend/src/{server,routes,plugins,types} (domain/application/infrastructure no se tocan, ya están aislados del framework HTTP)
* Si no se migra: plan de onboarding/documentación para que el resto del equipo pueda trabajar en Fastify

**Fuente:** Conversación de equipo sobre stack conocido (Express) vs Fastify actual

**Notas de avance:**

- 2026-10-24: sin decision. Se sigue con Fastify mientras el equipo no decida; no se ha escrito el documento en docs/ARCHITECTURE.md.

### [ ] KAN-173 - [Docs] Diario de Reflexión Fase 2 - Sebastián

- **Tipo:** Tarea | **Prioridad:** Highest | **Etiquetas:** Evaluacion2
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-173

Drive: Fase 2 > 1.Evidencias Individuales > Sebastian_Ramirez_2.1_APT122_DiarioReflexionFase2.docx

Completar el diario de reflexión individual.

**Notas de avance:**

-

### [ ] KAN-176 - [Docs] 2.4 Desarrollo Proyecto - Secc. 3 Ajustes a partir del monitoreo

- **Tipo:** Tarea | **Prioridad:** Highest | **Etiquetas:** Evaluacion2
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-176

Drive: Fase 2 > 2.Evidencias Grupales > 2.4_GuiaEstudiante_Fase 2_DesarrolloProyecto APT.docx

Completar sección 3: factores que facilitaron/dificultaron, actividades ajustadas o eliminadas, y actividades con retraso/sin iniciar con sus estrategias. Usar rúbrica 2.5.

**Notas de avance:**

-

### [ ] KAN-178 - [Docs] 2.6 Informe Final - Secc. 3 Metodología y 4 Desarrollo

- **Tipo:** Tarea | **Prioridad:** Highest | **Etiquetas:** Evaluacion2
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-178

Drive: Fase 2 > 2.Evidencias Grupales > 2.6_GuiaEstudiante_Fase 2_Informe Final Proyecto APT.docx

Completar sección 3 (metodología y su pertinencia) y sección 4 (desarrollo). Usar rúbrica 2.7.

**Notas de avance:**

-

### [ ] KAN-186 - [Diseño] 7. Planilla de casos de prueba

- **Tipo:** Tarea | **Prioridad:** Highest | **Etiquetas:** Evaluacion2
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-186

Drive: Fase 2 > 3.Evidencias Proyecto > 2. Documentos de Diseño > 7.Planilla Casos de Prueba.xlsx. Completar o mejorar lo marcado con 🔴.

**Notas de avance:**

-

### [ ] KAN-187 - [Diseño] 8. Documentación de la metodología

- **Tipo:** Tarea | **Prioridad:** Highest | **Etiquetas:** Evaluacion2
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-187

Drive: Fase 2 > 3.Evidencias Proyecto > 2. Documentos de Diseño > 8.Documentación generada en base a metodología elegida: listado de tareas y tablero Kanban (exportar desde Jira) y Registros de cambios e incidencias.xlsx. Completar o mejorar lo marcado con 🔴.

**Notas de avance:**

-

## Por hacer

### [ ] KAN-113 - [Admin] Dashboard estado de la plataforma

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

### [ ] KAN-114 - [Admin] Cola de moderación

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

### [ ] KAN-115 - [Admin] Aprobación y suspensión de proveedores

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

### [ ] KAN-119 - [Admin] Órdenes de la plataforma

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

### [ ] KAN-120 - [Admin] Reembolsos

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

### [ ] KAN-121 - [Admin] Gestión de usuarios

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

### [ ] KAN-122 - [Admin] Roles y permisos (matriz)

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

### [ ] KAN-123 - [Admin] Liquidaciones a proveedores

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

### [ ] KAN-124 - [Admin] Registro de auditoría

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

### [ ] KAN-147 - [API] Carro y creación de orden con split por proveedor

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

### [ ] KAN-149 - [API] Órdenes y estados de envío

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

- 2026-10-24: PARCIAL, lado ADMIN hecho (c59addc, migracion 0002): listado, ficha con documentos, aprobar/rechazar documento con motivo, aprobar/rechazar/suspender proveedor, auditoria. Probado contra la DB real. PENDIENTE (lado proveedor): perfil, cobertura, punto de retiro, subida de documentos y job que marca por_vencer/vencido.

### [ ] KAN-151 - [API] Usuarios, roles y permisos

- **Tipo:** Historia | **Prioridad:** High | **Etiquetas:** backend, plataforma
- **Jira:** https://samuelarcon40.atlassian.net/browse/KAN-151

Endpoints de administración de usuarios.

**Criterios de aceptación:**

* CRUD de usuarios con invitación por correo
* Lectura y escritura de la matriz rol.permisos (permisos_actualizado_por/en)

**Fuente:** Caso de uso 'Gestionar roles'

**Notas de avance:**

-

### [ ] KAN-152 - [API] Liquidaciones semanales

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

### [ ] KAN-153 - [API] Documentos tributarios simulados (SII)

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

### [ ] KAN-154 - [API] Ingesta de eventos analíticos

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

-
