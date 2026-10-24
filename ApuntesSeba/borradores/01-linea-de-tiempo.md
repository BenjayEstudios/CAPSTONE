# Linea de tiempo, hitos y ajustes al plan (solo lectura; analisis 2026-10-24)

Fuentes: actas 001-009 (Documentos de Gestion), Plan de pruebas.docx, `git log --all`, y 00-requisitos.md (para SC-01..06 y guia 2.4, no releidos). Asistentes en TODAS las actas: Samuel Alarcon (S), Benjamin Gonzalez (B), Sebastian Ramirez (R), los tres "Presente". Roles fijos en cada acta: S app mobile, BD, infraestructura; B ecommerce web + UX; R backend/API, admin-site y registro de actas. Firmas de conformidad: vacias en las 9 actas.

## 1. Linea de tiempo por acta
| Acta / fecha | Acuerdos y decisiones | Riesgos / problemas | Tareas (responsable, plazo) | Alcance |
|---|---|---|---|---|
| 001 · 29 ago (Kick Off) | Idea CompraMas elegida en acta 000 (22 ago; no esta en la carpeta). Scrum adaptado, reunion semanal sabado. Categorias: Alimentos, Aseo y hogar | MVP por equipo de 3; SII simulado; sin ultima milla ni scraping | Requerimientos v1 (B, 5 sep); mockups (S, 5 sep); encuesta/entrevista (R, 5 sep); carpeta Drive (S, 1 sep) | Define MVP y exclusiones |
| 002 · 5 sep | Jira (backlog), Drive, GitHub. Ecommerce en 2 experiencias + admin independiente. Historias de usuario + IEEE 830 | no consta | RNF y casos de uso (B, 12 sep); modelo BD draw.io (S, 12 sep); resumen encuesta (R, 12 sep) | Separa ecommerce comprador/distribuidor y admin |
| 003 · 12 sep | Valida requerimientos v1; orden unica con subordenes por proveedor | no consta | Diagrama de clases (B, 19 sep); actividad (S, 19 sep); arquitectura y stack (R, 19 sep) | Agrega RNF seguridad/rendimiento |
| 004 · 17 sep (jueves, feriado) | Monorepo (ecommerce, admin-site, mobile, API); PostgreSQL + Drizzle | Framework backend Fastify vs Express pendiente de PoC | Ajustar BDD (S, 26 sep); epicas y backlog (R, 26 sep); mockups (B, 26 sep) | no consta |
| 005 · 26 sep | BDD aprobado. 4 epicas; reparto: B ecommerce, R admin+API, S mobile/BD/infra. Fase 2 iterativa; Eval. 2 a fines de oct, final sem. 15 | no consta | Revisar guia 2.4/rubrica (R, 3 oct); historias de usuario (B, 3 oct); repo base monorepo (S, 3 oct) | no consta |
| 006 · 3 oct | Revision guia 2.4/rubrica 2.5; lista de documentos de diseno y gestion; cada uno redacta su diario | no consta | Epicas en Jira (R, 10 oct); borrador plan de pruebas (S, 10 oct); ajustar requerimientos (B, 10 oct) | no consta |
| 007 · 10 oct | Primera iteracion; Jira KAN el "lunes 13 oct" (el 13 oct 2026 es martes); columnas Por hacer/En curso/En revision/Listo | no consta | KAN-125/126 mobile + KAN-139 migraciones (S, 17 oct); KAN-166 admin + KAN-169 PoC Fastify/Express (R, 17 oct); KAN-89..99 vistas (B, 17 oct) | no consta |
| 008 · 17 oct | Backlog cargado (4 epicas). Reparto documentacion Eval. 2 (epica KAN-170). Mobile, plataforma, admin "en curso"; B: 23 tareas "por hacer" | Ecommerce web sin iniciar | Tareas doc en Jira (R, 20 oct); Diseno 4-6 KAN-183/184/185 (S, 23 oct); Diseno 7-8 KAN-186/187 (R, 23 oct); Diseno 1-3 KAN-180/181/182 (B, 23 oct); actas KAN-188..196 (S, 23 oct) | no consta |
| 009 · 22 oct (jueves) | Monitoreo: ecommerce web no inicia; decision backend KAN-169 como requisito de endpoints; entrega Eval. 2 el 24 oct | Retraso del ecommerce web | Entregar Eval. 2 (equipo, 24 oct); diarios KAN-171/172/173 (cada uno, 23 oct); ecommerce home/catalogo/busqueda KAN-89/90/91 (B, 31 oct); KAN-169 + API ofertas KAN-146 (R, 31 oct); mobile KAN-127/128 (S, 31 oct) | Posterga inicio ecommerce a sem. 13 |

## 2. Hitos tecnicos (git, `git log --all`)
| Fecha | Commit | Autor | Hito |
|---|---|---|---|
| 12 sep | 7325349 | SebaMax097 | Inicializacion del repo |
| 12 sep | 91b98bc, e5116f5 | benjayestudios | Subida/estructura de documentos |
| 22 sep | 561a456 (+merge 4f990ed, PR #1) | smyca / Samuel | Repo en Fase1/ y Proyecto/, README con flujo de ramas |
| 10 oct | 3078928 | lubravoy-duoc | "Add files via upload" (contenido no revisado) |
| 13 oct | 864c34a (+merge de99f98, PR #2) | Smyca / Samuel | Separa apps/web en ecommerce y admin-site; renombra rest a backend |
| 23 oct | 5e3ad58 | SebaMax097 | docker compose secuencial con healthchecks |
| 23 oct | 0a995fe | SebaMax097 | Esquema Drizzle primer corte + migracion 0001 (BD) |
| 23 oct | 6bfb9ba | SebaMax097 | Auth admin: JWT, /auth/me, seed (auth) |
| 23 oct | c03f5ca | SebaMax097 | Admin-site base, login, shell (KAN-166, 112, 167) |
| 23 oct | 049c516 | SebaMax097 | init SQL de desarrollo en contenedor mysql |
| 23 oct | dcc01a6, 3504e10, d1df6e2 | SebaMax097 | API y pantallas catalogo/categorias/ficha de producto (KAN-116/117/118) |
| 23 oct | 6494967 | SebaMax097 | Permisos por rol y subida local de imagenes |
| 24 oct | c59addc, 24b5063 | SebaMax097 | API y pantalla admin de proveedores (KAN-150, KAN-115), migracion 0002 |
| 24 oct | e55578c | SebaMax097 | CORS_ORIGIN con lista de origenes |

Conteo de commits (20 en total con `--all`, incluye 2 merges): SebaMax097 13 (12 de ellos el 23-24 oct); Samuel Alarcon / smyca / Smyca 4 (2 commits + 2 merges; misma persona segun contexto, no verificado); benjayestudios 2; lubravoy-duoc 1.
Por rama: local dev-sebamax 18 commits (los 12 nuevos no estan en origin; origin/dev-sebamax tiene 3); origin/dev 3; origin/dev-benjaycosas 3 (solo commits base); origin/dev-smy 6; origin/main 8. Commits de codigo con KAN-xxx anteriores al 23 oct: ninguno. Benjamin: solo los 2 commits de documentos (12 sep).

## 3. Ajustes al plan detectables
| Ajuste | Respaldo |
|---|---|
| Decision Fastify/Express: PoC pendiente desde 17 sep, plazo 17 oct (acta 7), "en curso" 17 oct (acta 8), replanteada al 31 oct (acta 9). El plan de pruebas ya asume Fastify | Actas 4, 7, 8, 9; Plan de pruebas |
| Inicio del ecommerce web (B) postergado a semana 13; plazo 31 oct | Acta 9 (ajuste explicito) |
| Actas (KAN-188..196) asignadas a S, aunque el rol fijo de R incluye "registro de actas" | Acta 8 vs roles de todas las actas |
| R asume ademas Diseno 7-8 (planilla casos de prueba, metodologia) | Acta 8 |
| Reorganizacion del repo: Fase1/Proyecto (22 sep) y ecommerce/admin-site/backend (13 oct) | 561a456, 864c34a |
| Reasignacion de BD/mobile a Samuel y endpoints a Sebastian descritos en guia 2.4; las actas no la registran como cambio | Guia 2.4 (via 00-requisitos); actas 5, 7-9 |
| Cronograma de pruebas 26 oct-20 nov con S/R/B por modulo | Plan de pruebas.docx |
| BD PostgreSQL (acta 4) pasa a MySQL (plan de pruebas e init SQL); ningun acta lo decide | Acta 4; Plan; 049c516 |

## 4. Retroalimentacion del docente
En las 9 actas: no consta ninguna mencion al docente ni a sus comentarios (solo revision de guia 2.4 y rubrica 2.5, actas 5-6). La guia 2.4 cita retroalimentacion sobre diagramas (via 00-requisitos); las actas no la respaldan. Plan de pruebas: no consta.

## 5. Contradicciones
| # | Contradiccion | Fuentes |
|---|---|---|
| 1 | KAN-146 (API de ofertas): el acta 9 lo asigna a Sebastian (R) y la guia 2.4 Secc. 3 asigna "usuarios, roles, ofertas y carrito" a Sebastian; SC-06 lo asigna a Benjamin, que es la version que indica el usuario | Acta 9; guia 2.4 y SC-06 (via 00-requisitos) |
| 2 | Las actas 5 y 7-9 mantienen el reparto original; la guia 2.4 habla de reasignaciones no registradas en actas ni en SC | Actas; guia 2.4 |
| 3 | Nombre del producto: CompraMas (actas) vs Cotizapp (plan de pruebas, planilla de casos) | Actas; Plan de pruebas |
| 4 | Motor BD: PostgreSQL (acta 4) vs MySQL (plan de pruebas, 049c516) | Acta 4; Plan; 049c516 |
| 5 | Acta 8 fija las actas 001-009 (tarea de S) a 23 oct, pero la acta 009 se realiza el 22 oct; acta 8 convoca el jueves 22 y no el sabado habitual | Actas 8-9 |
| 6 | Acta 8: B con 23 tareas "por hacer"; el plan de pruebas le asigna E2E del 16-20 nov; ecommerce sin desarrollo al 24 oct | Actas 8-9; Plan |
| 7 | Plan de pruebas: roles ambiguos (R y B comparten API; "Equipo completo" con B) | Plan de pruebas |
| 8 | SC-01..06 llegan solo al 12 oct y no recogen los ajustes de actas 8-9 (ecommerce postergado) | 00-requisitos (registro de cambios); actas 8-9 |
