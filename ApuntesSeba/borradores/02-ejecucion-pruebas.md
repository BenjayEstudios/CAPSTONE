# Ejecucion de pruebas - ciclo 1 (borrador)

- Fecha de ejecucion: 2026-10-24.
- Ejecutor: Claude (asistente) bajo supervision de Sebastian Ramirez.
- Entorno: Docker (cotizapp-backend API :8000, cotizapp-mysql, cotizapp-admin-site :4300), rama dev-sebamax. Autenticacion con JWT firmados dentro del contenedor (usuarios del seed: 1 administrador, 2 editor_catalogo, 3 proveedor, 5 comprador). No se imprimieron secretos.
- Planilla con resultados: `7.Planilla Casos de Prueba (borrador).xlsx` (copia; el original en `Fase 2/` no se toco). Los totales de la hoja Totales son formulas (se recalculan al abrir en Excel).
- Solo se registran resultados observados. Marca SI (columna G, "X") unicamente en casos verificados por API/tests; nada marcado NO.

## Resumen
| Concepto | Valor |
|---|---|
| Casos totales en la copia | 57 (CP 0001-0032 originales + CP 0033-0057 nuevos) |
| SI (OK) | 30: CP 0005, 0027, 0028, 0029, 0030, 0032 (CI, ya estaba) y CP 0033-0056 |
| NO (falla) | 0 |
| Sin marcar | 27: 26 "fuera del alcance de este ciclo" y CP 0057 (Angular sin entorno). La UI de 0027-0030 queda pendiente aunque van con SI por API |
| Pruebas automatizadas | 99 en verde (backend 25, application 72, infrastructure 2) |

## Suites del repo (dentro del contenedor)
- `pnpm exec turbo run test --force` global termina con error: `@cotizapp/ecommerce#test` falla (TS18003, no hay archivos `*.spec.ts`) y aborta el resto. Se corrio cada paquete por separado:
  - apps/backend (vitest): 5 archivos, 25 tests OK.
  - packages/application: 5 archivos, 72 tests OK.
  - packages/infrastructure: 1 archivo, 2 tests OK.
  - packages/domain: sin tests (`passWithNoTests`).
  - apps/admin-site (Karma): no ejecuta, `No binary for ChromeHeadless` (falta CHROME_BIN en el contenedor). Pendiente.
  - apps/ecommerce: sin specs. Pendiente.
- CP 0032 (CI GitHub Actions): no se toco.

## CP originales 0001-0032
| CP | Resultado | Evidencia / motivo |
|---|---|---|
| 0001-0003 | Pendiente: fuera del alcance | Registro de clientes no implementado |
| 0004 | Pendiente: fuera del alcance | Login de comprador no existe. Dato: login admin valido -> 200 + token (el admin tiene mfa inactivo, por eso no sale el 403 MFA_NO_IMPLEMENTADO que se esperaba) |
| 0005 | SI (parcial) | POST /auth/admin/login clave incorrecta -> 401 CREDENCIALES_INVALIDAS. Solo login admin |
| 0006-0007 | Pendiente: fuera del alcance | 2FA no implementado |
| 0008-0011 | Pendiente: fuera del alcance | Catalogo publico del comprador; equivalente admin en CP 0041. No hay filtro por rango de precio |
| 0012-0026 | Pendiente: fuera del alcance | Comparador, carro, checkout, pagos, ordenes, registro de proveedor y ofertas (KAN-146, de otra persona). Historias Jira restantes no confirmadas |
| 0027 | SI (API) | Proveedor en_revision con 3 documentos aprobados -> aprobar 200 activa. UI pendiente |
| 0028 | SI (API) | POST /productos -> 201, estado borrador. UI pendiente |
| 0029 | SI (API) | POST /categorias -> 201 y visible en listado admin (se uso nombre qa-tmp: "Lacteos" ya existe en el seed). UI pendiente |
| 0030 | SI (API) | Comprador: GET /productos 403, POST /categorias 403; sin token 401. UI pendiente |
| 0031 | Pendiente: fuera del alcance | App mobile no implementada |
| 0032 | Sin cambios | CI GitHub Actions |

## Casos nuevos CP 0033-0057 (resultado esperado = obtenido, salvo indicacion)
| CP | Caso | Resultado observado |
|---|---|---|
| 0033 | /auth/me | 401 sin token, 200 con token |
| 0034 | Login admin valido | 200, token, rol administrador |
| 0035 | Login body vacio | 400 VALIDACION |
| 0036 | Slug duplicado | 409 SLUG_DUPLICADO (qa-tmp y seed `lacteos`) |
| 0037 | Arbol 2 niveles | hija 201; nieta 400 ARBOL_MAXIMO_2_NIVELES |
| 0038 | Editar/ocultar categoria | 200; oculta no sale en publico; incluirOcultas: 401 sin token, admin la ve |
| 0039 | SKU duplicado / validacion | 409 SKU_DUPLICADO; 400 VALIDACION |
| 0040 | Editar y publicar producto | 200 / 200 publicado |
| 0041 | Listado con q y categoriaId | 200 filtrado |
| 0042 | Subir PNG 1300x400 | 201, ancho 1300 |
| 0043 | Subir texto como .png | 400 FORMATO_NO_SOPORTADO |
| 0044 | Ancho < 1200 | subida 400 IMAGEN_MUY_PEQUENA; PUT 400 VALIDACION |
| 0045 | Galeria + ficha | PUT 200; ficha incluye imagen |
| 0046 | Rechazar documento | con motivo 200; sin motivo 400 |
| 0047 | Aprobar documento | 200; documento de otro proveedor 404 |
| 0048 | Aprobar con requisitos incompletos | 409 REQUISITOS_INCOMPLETOS (pendientes y con uno rechazado) |
| 0049 | Transiciones invalidas | 409 TRANSICION_INVALIDA (aprobar activo, suspender suspendido) |
| 0050 | Rechazar proveedor | con motivo 200 suspendida; sin motivo 400 |
| 0051 | Suspender proveedor | con motivo 200; sin motivo 400 |
| 0052 | Permisos catalogo | admin 200, editor 200 (y crea 201), proveedor 403, comprador 403, sin token 401; proveedor sube imagen 403 |
| 0053 | Permisos proveedores | editor 403, proveedor 403, admin 200; editor aprobar 403 |
| 0054 | CORS :4300 | 204 con ACAO :4300 |
| 0055 | CORS origen ajeno | 204 sin ACAO |
| 0056 | Suites vitest | 99 tests OK |
| 0057 | Angular admin-site/ecommerce | No ejecutado (sin Chrome / sin specs) |

## Hallazgos para el lider
1. CORS: el contenedor tiene `CORS_ORIGIN=http://localhost:4300`; el origen :4200 NO queda permitido, aunque el commit e55578c lo declara por defecto. Es configuracion del `.env`, no del codigo; conviene revisar si se quiere :4200 en el entorno.
2. El admin del seed tiene mfa inactivo, por lo que el login responde 200, no 403 MFA_NO_IMPLEMENTADO (ese 403 solo ocurre con mfa activo).
3. `turbo run test` global falla por ecommerce (sin specs) y admin-site (sin Chrome); la CI debe contemplarlo.

## Pasos manuales (UI) pendientes
Requisito: http://localhost:4300 con sesion de administrador.
- CP 0027: Proveedores > abrir uno en revision > aprobar los 3 documentos > Aprobar proveedor; verificar estado activa. Probar tambien Aprobar con un documento pendiente (debe avisar requisitos incompletos).
- CP 0028: Catalogo > Nuevo producto (SKU, categoria Abarrotes) > Guardar; verificar estado borrador.
- CP 0029: Categorias > Nueva categoria; verificar que aparece en el listado.
- CP 0030: abrir http://localhost:4300 sin sesion y con un usuario no administrador; verificar que se deniega.
- CP 0045: ficha de producto > subir imagen >= 1200 px, ver galeria; probar un archivo de texto y una imagen de < 1200 px.

## Datos de prueba y limpieza
- Se crearon y borraron: 3 organizaciones qa-tmp (proveedores), 5 documentos, 2 productos QA-TMP-*, 2 categorias qa-tmp-*, y 7 filas de auditoria_log generadas por las pruebas (la tabla estaba vacia antes). Conteos finales: producto 7, categoria 9, organizacion 4, proveedor_documento 0, auditoria_log 0 (igual que al inicio).
- NO se pudo borrar un archivo subido: el sistema de seguridad bloqueo el `rm` dentro del contenedor. Queda `/data/uploads/productos/10/32278254-7988-4d35-a8d8-745e71cf6c48.png` (PNG de prueba 1300x400, sin referencia en la DB). Borrarlo a mano: `docker exec cotizapp-backend rm /data/uploads/productos/10/32278254-7988-4d35-a8d8-745e71cf6c48.png`.
