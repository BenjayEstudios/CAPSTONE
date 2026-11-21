# Guion de pruebas de usabilidad (KAN-165)

Pruebas moderadas con usuarios que representen a quienes usarán Cotizapp:
pymes compradoras, distribuidores y el equipo interno. El objetivo es ver
dónde se traban al hacer tareas reales, no evaluar a la persona.

## Participantes

| Perfil | Cuántos | A quién buscar | Dónde prueba |
|---|---|---|---|
| Cliente (pyme compradora) | 3 a 5 | Quien hace las compras en un restaurante, pastelería, almacén o casino | Web (ecommerce) y app mobile |
| Proveedor (distribuidor) | 2 a 3 | Quien maneja ventas o despacho en un distribuidor mayorista | Web (panel del proveedor) y app mobile |
| Administrador | 1 a 2 | Alguien del equipo o del curso que no haya construido esa parte | admin-site |

Con 5 personas por perfil aparecen la mayoría de los problemas graves; con
menos, igual sirve para encontrar los más evidentes.

## Preparación

- Ambiente: QA o local con el seed recién cargado
  (`pnpm --filter @cotizapp/infrastructure db:seed`). Backend con
  `PASARELA=simulada` para que el pago no pase por Transbank (sin tarjeta de
  prueba).
- Cuentas: el comprador crea la suya en la tarea C1. Proveedor:
  `ventas@losandes.test`. Admin: `admin@cotizapp.test`. Clave del seed:
  `Cotizapp.2026` (ver
  [CUENTAS-DE-PRUEBA.md](../desarrollo/CUENTAS-DE-PRUEBA.md)).
- Mobile: el APK de la demo instalado y apuntando al mismo backend.
- Grabación de pantalla y audio, con consentimiento.
- Un moderador (guía la sesión, no ayuda) y un observador (anota).

## Cómo se conduce la sesión (40 minutos)

1. **Bienvenida (3 min)**. Leer: "Estamos probando el sistema, no a ti. Si
   algo cuesta, es un problema del sistema y nos sirve saberlo. Piensa en voz
   alta: di lo que buscas, lo que esperas y lo que te sorprende." Pedir el
   consentimiento para grabar.
2. **Contexto (2 min)**. Preguntar cómo compra o vende hoy (teléfono,
   WhatsApp, planillas, visitas) y qué le molesta de eso.
3. **Tareas (25 min)**. Leer cada tarea tal como está escrita, sin nombrar
   botones ni pantallas. No ayudar. Si la persona se traba más de 2 minutos,
   anotar "no completada" y pasar a la siguiente.
4. **Cierre (10 min)**. Formulario de retroalimentación y dos preguntas
   abiertas: qué fue lo más difícil y qué cambiaría primero.

Después de cada tarea, preguntar: "Del 1 al 7, ¿qué tan fácil fue?" (1 muy
difícil, 7 muy fácil).

## Hoja de observación (una fila por tarea)

| Tarea | Completó (sí / con ayuda / no) | Tiempo | Errores o desvíos | Facilidad 1-7 | Citas textuales |
|---|---|---|---|---|---|

## Tareas: cliente (web)

| # | Tarea (se lee tal cual) | Se completa cuando |
|---|---|---|
| C1 | "Tu restaurante quiere empezar a comprar en Cotizapp. Crea una cuenta para tu empresa." | Entra con su cuenta |
| C2 | "Necesitas aceite para la cocina. Encuentra el aceite vegetal más barato." | Abre la ficha del aceite vegetal y reconoce al proveedor más barato |
| C3 | "Compara los proveedores de ese aceite: precio, plazo de entrega y calificación. ¿Con cuál comprarías y por qué?" | Explica su elección con datos de la ficha |
| C4 | "Agrega 2 cajas de ese aceite y algo de otro proveedor, por ejemplo arroz o lentejas." | El carro tiene productos de dos proveedores |
| C5 | "Revisa tu carro: ¿cuánto pagas de despacho y cuándo llega cada parte?" | Lee el despacho y el plazo por proveedor |
| C6 | "Compra y paga. Despacho a la dirección de tu restaurante." | Llega a la confirmación con el pago aprobado |
| C7 | "Revisa en qué estado está tu pedido y qué le compraste a cada proveedor." | Abre el detalle en "Mis pedidos" |
| C8 | "Uno de tus pedidos ya llegó. Califica al proveedor." | Califica un envío entregado (usar una orden entregada del seed si hace falta) |

## Tareas: cliente (mobile)

| # | Tarea | Se completa cuando |
|---|---|---|
| M1 | "Entra a la app con tu cuenta." | Ve el inicio |
| M2 | "Busca queso gauda y compara los proveedores." | Abre la ficha con el comparador |
| M3 | "Agrega queso al carro y paga." | Llega a la confirmación |
| M4 | "Revisa tus pedidos y el estado de cada envío." | Ve "Mis pedidos" con los estados |

## Tareas: proveedor (web y mobile)

| # | Tarea | Se completa cuando |
|---|---|---|
| P1 | "Entra al panel de tu distribuidora. ¿Cuánto vendiste este mes y qué te pide atención?" | Lee el resumen y las alertas del panel |
| P2 | "Empieza a vender harina sin polvos de hornear: publícala a un precio y stock que te convengan." | Publica la oferta (o entiende por qué el tope no la deja) |
| P3 | "Llegaron 20 cajas más de leche. Actualiza el stock." | Edita las cajas en "Mis productos" |
| P4 | "¿Cómo está tu precio del arroz frente a los otros proveedores?" | Lee su posición en "Cómo se compara tu precio" |
| P5 | "Llegó una orden nueva. Prepárala y márcala como despachada." | Avanza el envío en "Órdenes" |
| P6 | "Despachas también a Ñuñoa. Agrega esa comuna con un costo de despacho de $2.990." | La zona aparece en "Cobertura" |
| P7 | "Tu certificado de vigencia está por vencer. Sube uno nuevo." | Sube el archivo y ve "Pendiente de revisión" |
| P8 | "¿Cuánto te debe Cotizapp y qué envíos incluye la última liquidación?" | Lee "Por cobrar" y abre el detalle |
| P9 (mobile) | "Desde el teléfono, revisa las órdenes vigentes y tus calificaciones." | Ve las órdenes y las reseñas en la app |

## Tareas: administrador

Si alguna pantalla del admin-site todavía no está lista en la versión que se
prueba, la tarea se marca "no aplica" (no "no completada").

| # | Tarea | Se completa cuando |
|---|---|---|
| A1 | "Entra al panel de administración." | Ve el inicio del panel |
| A2 | "Un distribuidor nuevo pidió vender en Cotizapp. Revisa sus documentos y apruébalo o recházalo." | Cambia el estado del proveedor |
| A3 | "Hay un precio publicado muy por sobre la referencia. Encuéntralo y resuelve el caso." | Resuelve o descarta el caso en la cola de moderación |
| A4 | "Un comprador pide la devolución de una orden. Encuéntrala y haz el reembolso." | Registra el reembolso |
| A5 | "¿Cuánto hay que pagarle a cada proveedor esta semana?" | Lee las liquidaciones pendientes |

## Qué medir

- **Tasa de éxito**: tareas completadas sin ayuda / tareas intentadas.
- **Tiempo por tarea** (desde que termina de leerla hasta que la completa o se rinde).
- **Errores**: clics en un lugar equivocado, vueltas atrás, mensajes de error.
- **Facilidad percibida** (1 a 7 por tarea) y **SUS** al final (formulario).
- **Citas**: lo que dice la persona, literal. Suele ser lo más útil del informe.
