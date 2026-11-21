// Genera flujo-compra.postman_collection.json (KAN-164): la prueba end-to-end
// del flujo de compra, con asserts, para Postman o Newman (CI).
//
//   node docs/desarrollo/postman/generar-flujo-compra.mjs
//
// El flujo: registro de un comprador nuevo -> ingreso -> buscar -> comparar
// las ofertas de un producto -> carro con dos proveedores -> opciones de
// entrega -> confirmar (checkout) -> iniciar el pago -> retorno de la
// pasarela -> orden pagada con un envio por proveedor -> el proveedor ve su
// tramo y lo avanza -> el comprador ve la orden en preparacion.
//
// Necesita el seed cargado y el backend con PASARELA=simulada (la pasarela
// simulada aprueba sin Transbank). Cada corrida crea un comprador nuevo.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const codigo = (lineas) => lineas.join("\n").split("\n");

// Cuentas de proveedor del seed (docs/desarrollo/CUENTAS-DE-PRUEBA.md).
const PROVEEDORES = { 2: "ventas@losandes.test", 3: "pedidos@vallecentral.test", 4: "comercial@frigosur.test" };

const req = (nombre, metodo, ruta, { cuerpo, prueba, previo, auth = "comprador", sinRedirecciones = false } = {}) => ({
  name: nombre,
  ...(sinRedirecciones ? { protocolProfileBehavior: { followRedirects: false } } : {}),
  event: [
    ...(previo ? [{ listen: "prerequest", script: { type: "text/javascript", exec: codigo(previo) } }] : []),
    ...(prueba ? [{ listen: "test", script: { type: "text/javascript", exec: codigo(prueba) } }] : [])
  ],
  request: {
    method: metodo,
    header: [
      ...(cuerpo ? [{ key: "Content-Type", value: "application/json" }] : []),
      ...(auth ? [{ key: "Authorization", value: `Bearer {{token_${auth}}}` }] : [])
    ],
    ...(cuerpo ? { body: { mode: "raw", raw: JSON.stringify(cuerpo, null, 2) } } : {}),
    url: `{{baseUrl}}${ruta}`
  }
});

const items = [
  req("1 · Registro de un comprador nuevo", "POST", "/auth/registro/comprador", {
    auth: null,
    previo: [
      "// RUT valido al azar (modulo 11) y correo unico por corrida.",
      "const n = Math.floor(10000000 + Math.random() * 15000000);",
      "let s = 0, m = 2;",
      "for (const d of String(n).split('').reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; }",
      "const r = 11 - (s % 11);",
      "const dv = r === 11 ? '0' : r === 10 ? 'K' : String(r);",
      "pm.collectionVariables.set('rut', `${n}-${dv}`);",
      "pm.collectionVariables.set('email', `e2e-${Date.now()}@cotizapp.test`);"
    ],
    cuerpo: { nombre: "Comprador E2E", email: "{{email}}", clave: "{{clave}}", rut: "{{rut}}" },
    prueba: [
      "pm.test('201 con sesion de comprador', () => {",
      "  pm.response.to.have.status(201);",
      "  const r = pm.response.json();",
      "  pm.expect(r.token).to.be.a('string');",
      "  pm.expect(r.usuario.email).to.eql(pm.collectionVariables.get('email'));",
      "});"
    ]
  }),
  req("2 · Ingreso del comprador", "POST", "/auth/login", {
    auth: null,
    cuerpo: { email: "{{email}}", clave: "{{clave}}" },
    prueba: [
      "pm.test('200 con token', () => {",
      "  pm.response.to.have.status(200);",
      "  pm.collectionVariables.set('token_comprador', pm.response.json().token);",
      "});"
    ]
  }),
  req("3 · Buscar en el catalogo", "GET", "/catalogo/productos?q={{termino}}&tamano=20", {
    auth: null,
    prueba: [
      "pm.test('encuentra un producto que venden al menos dos proveedores', () => {",
      "  pm.response.to.have.status(200);",
      "  const p = pm.response.json().items.find((i) => i.ofertas >= 2);",
      "  pm.expect(p, 'producto con 2+ ofertas').to.exist;",
      "  pm.collectionVariables.set('productoId', p.id);",
      "});"
    ]
  }),
  req("4 · Comparar las ofertas del producto", "GET", "/catalogo/productos/{{productoId}}", {
    auth: null,
    prueba: [
      "pm.test('elige las dos ofertas mas baratas de proveedores distintos que despachan', () => {",
      "  pm.response.to.have.status(200);",
      "  const ofertas = pm.response.json().ofertas",
      "    .filter((o) => o.modalidadEntrega !== 'retiro' && (o.cajasDisponibles ?? 1) > 0)",
      "    .sort((a, b) => a.precioUnitario - b.precioUnitario);",
      "  const elegidas = [];",
      "  for (const o of ofertas) if (!elegidas.some((e) => e.proveedor.id === o.proveedor.id)) elegidas.push(o);",
      "  pm.expect(elegidas.length).to.be.at.least(2);",
      "  // El minimo de compra va en unidades; la cantidad del carro, en cajas.",
      "  const linea = (o) => ({ ofertaId: o.id, cantidad: Math.max(1, Math.ceil((o.minimoCompra ?? 1) / (o.unidadesPorCaja ?? 1))), precioVisto: o.precioUnitario });",
      "  pm.collectionVariables.set('items', JSON.stringify(elegidas.slice(0, 2).map(linea)));",
      "  pm.collectionVariables.set('proveedores', JSON.stringify(elegidas.slice(0, 2).map((o) => o.proveedor.id)));",
      "});"
    ]
  }),
  req("5 · Carro multiproveedor", "PUT", "/carro", {
    previo: ["pm.request.body.raw = JSON.stringify({ items: JSON.parse(pm.collectionVariables.get('items')) });"],
    cuerpo: { items: [] },
    prueba: [
      "pm.test('200 con las dos lineas disponibles', () => {",
      "  pm.response.to.have.status(200);",
      "  const c = pm.response.json();",
      "  pm.expect(c.items).to.have.length(2);",
      "  pm.expect(c.items.every((i) => i.disponible)).to.be.true;",
      "});"
    ]
  }),
  req("6 · Opciones de entrega", "GET", "/carro/opciones-entrega", {
    prueba: [
      "pm.test('los dos proveedores despachan a la Region Metropolitana', () => {",
      "  pm.response.to.have.status(200);",
      "  const cob = pm.response.json().coberturas;",
      "  for (const id of JSON.parse(pm.collectionVariables.get('proveedores'))) {",
      "    pm.expect(cob.some((c) => c.proveedorId === id && c.regionCodigo === '13'), `proveedor ${id}`).to.be.true;",
      "  }",
      "});"
    ]
  }),
  req("7 · Confirmar el carro (checkout)", "POST", "/carro/confirmar", {
    cuerpo: { direccion: { comunaId: 20, calle: "Av. Irarrázaval", numero: "3450", complemento: "E2E" }, retiros: [], requiereFactura: false },
    prueba: [
      "pm.test('201: la orden queda pendiente de pago', () => {",
      "  pm.response.to.have.status(201);",
      "  const o = pm.response.json();",
      "  pm.expect(o.codigo).to.match(/^CM-/);",
      "  pm.collectionVariables.set('ordenId', o.ordenId);",
      "  pm.collectionVariables.set('codigo', o.codigo);",
      "});"
    ]
  }),
  req("8 · Iniciar el pago (pasarela sandbox)", "POST", "/ordenes/{{ordenId}}/pago", {
    cuerpo: { medioPago: "tarjeta" },
    prueba: [
      "pm.test('201 con el token de la pasarela', () => {",
      "  pm.response.to.have.status(201);",
      "  const p = pm.response.json();",
      "  pm.expect(p.token).to.be.a('string');",
      "  pm.expect(p.urlPago).to.be.a('string');",
      "  pm.collectionVariables.set('tokenPago', p.token);",
      "});"
    ]
  }),
  req("9 · Retorno de la pasarela", "GET", "/pagos/webpay/retorno?token_ws={{tokenPago}}", {
    auth: null,
    sinRedirecciones: true,
    prueba: [
      "pm.test('303 al resultado con el pago aprobado', () => {",
      "  pm.response.to.have.status(303);",
      "  const destino = pm.response.headers.get('Location');",
      "  pm.expect(destino).to.include(`orden=${pm.collectionVariables.get('ordenId')}`);",
      "  pm.expect(destino).to.include('pago=aprobado');",
      "});"
    ]
  }),
  req("10 · Orden pagada con un envio por proveedor", "GET", "/ordenes/{{ordenId}}", {
    previo: [`pm.collectionVariables.set('cuentasProveedor', ${JSON.stringify(JSON.stringify(PROVEEDORES))});`],
    prueba: [
      "const o = pm.response.json();",
      "pm.test('pagada', () => {",
      "  pm.response.to.have.status(200);",
      "  pm.expect(o.estado).to.eql('pagada');",
      "  pm.expect(o.estadoPago).to.eql('pagado');",
      "});",
      "pm.test('un envio por proveedor, cada uno con sus lineas y su monto', () => {",
      "  const ids = JSON.parse(pm.collectionVariables.get('proveedores'));",
      "  pm.expect(o.envios.map((e) => e.proveedorId).sort()).to.eql([...ids].sort());",
      "  for (const e of o.envios) {",
      "    pm.expect(e.estado).to.eql('por_despachar');",
      "    pm.expect(e.subtotal).to.eql(e.lineas.reduce((t, l) => t + l.totalLinea, 0));",
      "  }",
      "  pm.expect(o.total).to.eql(o.envios.reduce((t, e) => t + e.montoEnvio, 0));",
      "});",
      "const envio = o.envios[0];",
      "pm.collectionVariables.set('envioId', envio.id);",
      "pm.collectionVariables.set('proveedorId', envio.proveedorId);",
      "pm.collectionVariables.set('emailProveedor', JSON.parse(pm.collectionVariables.get('cuentasProveedor'))[envio.proveedorId]);"
    ]
  }),
  req("11 · Ingreso del proveedor del primer envio", "POST", "/auth/login", {
    auth: null,
    cuerpo: { email: "{{emailProveedor}}", clave: "{{claveSeed}}" },
    prueba: [
      "pm.test('200 con token de proveedor', () => {",
      "  pm.response.to.have.status(200);",
      "  pm.collectionVariables.set('token_proveedor', pm.response.json().token);",
      "});"
    ]
  }),
  req("12 · El proveedor ve solo su tramo en sus ventas", "GET", "/proveedor/ventas?estado=por_despachar&tamano=100", {
    auth: "proveedor",
    prueba: [
      "pm.test('su envio aparece por despachar, con su monto y no el total de la orden', () => {",
      "  pm.response.to.have.status(200);",
      "  const v = pm.response.json().items.find((x) => x.envioId === Number(pm.collectionVariables.get('envioId')));",
      "  pm.expect(v, 'venta del envio').to.exist;",
      "  pm.expect(v.folio).to.eql(pm.collectionVariables.get('codigo'));",
      "  pm.expect(v.siguiente).to.eql('en_preparacion');",
      "  pm.expect(pm.response.json().items.some((x) => x.ordenId === v.ordenId && x.envioId !== v.envioId)).to.be.false;",
      "});"
    ]
  }),
  req("13 · El proveedor prepara su envio", "PATCH", "/ordenes/envios/{{envioId}}/estado", {
    auth: "proveedor",
    cuerpo: { estado: "en_preparacion" },
    prueba: ["pm.test('200 en preparacion', () => {", "  pm.response.to.have.status(200);", "  pm.expect(pm.response.json().estado).to.eql('en_preparacion');", "});"]
  }),
  req("14 · El comprador ve la orden en preparacion", "GET", "/ordenes/{{ordenId}}", {
    prueba: [
      "pm.test('la orden pasa a en preparacion y el otro envio sigue por despachar', () => {",
      "  pm.response.to.have.status(200);",
      "  const o = pm.response.json();",
      "  pm.expect(o.estado).to.eql('en_preparacion');",
      "  const otro = o.envios.find((e) => e.id !== Number(pm.collectionVariables.get('envioId')));",
      "  pm.expect(otro.estado).to.eql('por_despachar');",
      "});"
    ]
  })
];

const coleccion = {
  info: {
    name: "Cotizapp · Flujo de compra (E2E, KAN-164)",
    description:
      "Prueba end-to-end del flujo central: registro, busqueda, comparacion, carro multiproveedor, checkout, pago (pasarela simulada) y envios por proveedor. Requiere el seed y el backend con PASARELA=simulada. Generada por generar-flujo-compra.mjs: no editar a mano.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:8000" },
    { key: "termino", value: "aceite" },
    { key: "clave", value: "E2e.Prueba2026" },
    { key: "claveSeed", value: "Cotizapp.2026" }
  ],
  item: items
};

writeFileSync(join(aqui, "flujo-compra.postman_collection.json"), JSON.stringify(coleccion, null, 2) + "\n");
console.log(`flujo-compra.postman_collection.json: ${items.length} requests`);
