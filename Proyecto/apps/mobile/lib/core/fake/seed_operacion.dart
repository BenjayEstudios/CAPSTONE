// Datos operativos del seed (packages/infrastructure/src/db/seed/seed.ts y
// catalogo.ts) que usa FakeBackend: geografía, direcciones, puntos de
// retiro, coberturas, documentos y las 11 órdenes. Mismos IDs que la base
// del equipo; si cambia el seed, actualizar acá.

// --- Geografía (catalogo.ts: comunas). id = posición + 1 ---

typedef SeedComuna = ({int id, String codigo, String nombre, String regionCodigo, String regionNombre});

const _rm = ('13', 'Metropolitana de Santiago');
const _valpo = ('05', 'Valparaíso');
const _biobio = ('08', 'Biobío');

const _comunas = <(String, String, (String, String))>[
  ('13101', 'Santiago', _rm),
  ('13102', 'Cerrillos', _rm),
  ('13103', 'Cerro Navia', _rm),
  ('13104', 'Conchalí', _rm),
  ('13105', 'El Bosque', _rm),
  ('13106', 'Estación Central', _rm),
  ('13107', 'Huechuraba', _rm),
  ('13108', 'Independencia', _rm),
  ('13109', 'La Cisterna', _rm),
  ('13110', 'La Florida', _rm),
  ('13111', 'La Granja', _rm),
  ('13112', 'La Pintana', _rm),
  ('13113', 'La Reina', _rm),
  ('13114', 'Las Condes', _rm),
  ('13115', 'Lo Barnechea', _rm),
  ('13116', 'Lo Espejo', _rm),
  ('13117', 'Lo Prado', _rm),
  ('13118', 'Macul', _rm),
  ('13119', 'Maipú', _rm),
  ('13120', 'Ñuñoa', _rm),
  ('13121', 'Pedro Aguirre Cerda', _rm),
  ('13122', 'Peñalolén', _rm),
  ('13123', 'Providencia', _rm),
  ('13124', 'Pudahuel', _rm),
  ('13125', 'Quilicura', _rm),
  ('13126', 'Quinta Normal', _rm),
  ('13127', 'Recoleta', _rm),
  ('13128', 'Renca', _rm),
  ('13129', 'San Joaquín', _rm),
  ('13130', 'San Miguel', _rm),
  ('13131', 'San Ramón', _rm),
  ('13132', 'Vitacura', _rm),
  ('13201', 'Puente Alto', _rm),
  ('05101', 'Valparaíso', _valpo),
  ('05109', 'Viña del Mar', _valpo),
  ('08101', 'Concepción', _biobio),
  ('08110', 'Talcahuano', _biobio),
];

final List<SeedComuna> seedComunas = [
  for (final (i, (codigo, nombre, (regionCodigo, regionNombre))) in _comunas.indexed)
    (id: i + 1, codigo: codigo, nombre: nombre, regionCodigo: regionCodigo, regionNombre: regionNombre),
];

SeedComuna seedComuna(int id) => seedComunas[id - 1];
int seedComunaId(String codigo) => seedComunas.firstWhere((c) => c.codigo == codigo).id;

// --- Direcciones (seed.ts) ---

typedef SeedDireccion = ({int id, int comunaId, String calle, String? numero, String? complemento, String? referencia});

final List<SeedDireccion> seedDirecciones = [
  (
    id: 1,
    comunaId: seedComunaId('13123'),
    calle: 'Av. Providencia',
    numero: '1208',
    complemento: 'Of. 501',
    referencia: null
  ),
  (
    id: 2,
    comunaId: seedComunaId('13125'),
    calle: 'Av. Presidente Eduardo Frei Montalva',
    numero: '9650',
    complemento: 'Bodega 12',
    referencia: null
  ),
  (id: 3, comunaId: seedComunaId('13124'), calle: 'Camino Lo Boza', numero: '120', complemento: null, referencia: null),
  (
    id: 4,
    comunaId: seedComunaId('13128'),
    calle: 'Av. Jorge Hirmas',
    numero: '2440',
    complemento: null,
    referencia: null
  ),
  (
    id: 5,
    comunaId: seedComunaId('13119'),
    calle: 'Camino a Rinconada',
    numero: '3100',
    complemento: null,
    referencia: null
  ),
  (
    id: 6,
    comunaId: seedComunaId('13120'),
    calle: 'Av. Irarrázaval',
    numero: '3450',
    complemento: 'Local 2',
    referencia: 'Entrada de proveedores por calle lateral',
  ),
  (id: 7, comunaId: seedComunaId('13114'), calle: 'Av. Apoquindo', numero: '5550', complemento: null, referencia: null),
];

SeedDireccion seedDireccion(int id) => seedDirecciones.firstWhere((d) => d.id == id);

// Dirección de entrega habitual de cada organización cliente (CLIENTE en seed.ts).
const seedDireccionDeCliente = {6: 6, 7: 7};

// --- Puntos de retiro y cobertura de despacho ---

typedef SeedPuntoRetiro = ({int id, int proveedorId, int direccionId, String nombre, String horario});

const seedPuntosRetiro = <SeedPuntoRetiro>[
  (
    id: 1,
    proveedorId: 2,
    direccionId: 2,
    nombre: 'Bodega Quilicura',
    horario: 'Lun a Vie 08:00-17:00, Sáb 09:00-13:00'
  ),
  (id: 2, proveedorId: 4, direccionId: 4, nombre: 'Planta Renca', horario: 'Lun a Vie 07:30-16:00'),
];

// comunaId null = toda la región.
typedef SeedCobertura = ({int proveedorId, String regionCodigo, int? comunaId, int costoDespacho, int plazoHoras});

final List<SeedCobertura> seedCoberturas = [
  (proveedorId: 2, regionCodigo: '13', comunaId: null, costoDespacho: 4990, plazoHoras: 24),
  (proveedorId: 2, regionCodigo: '05', comunaId: null, costoDespacho: 12990, plazoHoras: 72),
  (proveedorId: 3, regionCodigo: '13', comunaId: null, costoDespacho: 5990, plazoHoras: 48),
  (proveedorId: 4, regionCodigo: '13', comunaId: null, costoDespacho: 6990, plazoHoras: 24),
  (proveedorId: 4, regionCodigo: '08', comunaId: null, costoDespacho: 9990, plazoHoras: 48),
  (proveedorId: 5, regionCodigo: '13', comunaId: seedComunaId('13119'), costoDespacho: 2990, plazoHoras: 48),
  (proveedorId: 5, regionCodigo: '13', comunaId: seedComunaId('13102'), costoDespacho: 2990, plazoHoras: 48),
  (proveedorId: 5, regionCodigo: '13', comunaId: seedComunaId('13106'), costoDespacho: 3490, plazoHoras: 48),
];

// Condiciones comerciales que no están en SeedProveedor (organizacion en seed.ts).
typedef SeedCondiciones = ({double comisionPct, bool ofreceDespacho, bool ofreceRetiro});

const seedCondiciones = <int, SeedCondiciones>{
  2: (comisionPct: 8, ofreceDespacho: true, ofreceRetiro: true),
  3: (comisionPct: 7.5, ofreceDespacho: true, ofreceRetiro: false),
  4: (comisionPct: 9, ofreceDespacho: true, ofreceRetiro: true),
  5: (comisionPct: 8, ofreceDespacho: true, ofreceRetiro: false),
};

// --- Documentos del proveedor (documentosDe en seed.ts) ---
// Carpeta tributaria sin vencimiento; resolución sanitaria con fecha.

const seedVencimientoSanitaria = {2: '2027-06-30', 3: '2026-11-15', 4: '2027-03-31', 5: '2027-01-31'};

// --- Órdenes (seedOrdenes en seed.ts) ---

typedef SeedEnvioDef = ({
  int proveedorId,
  String modalidad,
  int? puntoRetiroId,
  String estado,
  List<(int, int)> lineas, // (productoId, cantidad)
  (int, String?)? calificacion, // (puntaje, comentario)
});

typedef SeedOrdenDef = ({
  int id,
  String codigo,
  int clienteId, // organización cliente
  String estado,
  String medioPago,
  String creadaEn, // hora de Chile, como la interpreta seed.ts en la máquina del equipo
  List<SeedEnvioDef> envios,
});

// Usuario comprador de cada organización cliente.
const seedUsuarioDeCliente = {6: 8, 7: 9};
// Dulce Hogar siempre pide factura.
const seedClienteConFactura = {7};

const List<SeedOrdenDef> seedOrdenes = [
  (
    id: 1,
    codigo: 'CM-10001',
    clienteId: 6,
    estado: 'entregada',
    medioPago: 'tarjeta',
    creadaEn: '2026-10-06T10:15:00-03:00',
    envios: [
      (
        proveedorId: 2,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(1, 4), (3, 3), (11, 2)],
        calificacion: (5, 'Llegó todo antes de la hora de corte y bien embalado.')
      ),
      (
        proveedorId: 4,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(12, 10), (13, 8)],
        calificacion: (4, 'Buena cadena de frío; el camión llegó una hora tarde.')
      ),
    ],
  ),
  (
    id: 2,
    codigo: 'CM-10002',
    clienteId: 7,
    estado: 'en_preparacion',
    medioPago: 'transferencia',
    creadaEn: '2026-10-20T17:40:00-03:00',
    envios: [
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'en_preparacion',
        lineas: [(5, 2), (6, 1), (10, 6)],
        calificacion: null
      ),
      (
        proveedorId: 2,
        modalidad: 'retiro',
        puntoRetiroId: 1,
        estado: 'listo_retiro',
        lineas: [(11, 5)],
        calificacion: null
      ),
    ],
  ),
  (
    id: 3,
    codigo: 'CM-10003',
    clienteId: 6,
    estado: 'entregada',
    medioPago: 'tarjeta',
    creadaEn: '2026-09-01T09:20:00-03:00',
    envios: [
      (
        proveedorId: 2,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(2, 6), (4, 10), (9, 24)],
        calificacion: (5, null)
      ),
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(8, 4), (14, 6)],
        calificacion: (4, 'Paltas en buen punto.')
      ),
    ],
  ),
  (
    id: 4,
    codigo: 'CM-10004',
    clienteId: 7,
    estado: 'entregada',
    medioPago: 'transferencia',
    creadaEn: '2026-09-04T15:05:00-03:00',
    envios: [
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(3, 5), (15, 36)],
        calificacion: (3, 'Llegaron 4 kg de tomate machucados, reclamo resuelto con nota de crédito.')
      ),
      (
        proveedorId: 4,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(7, 4), (10, 12)],
        calificacion: (5, 'Crema con buena fecha de vencimiento.')
      ),
    ],
  ),
  (
    id: 5,
    codigo: 'CM-10005',
    clienteId: 6,
    estado: 'entregada',
    medioPago: 'linea_credito',
    creadaEn: '2026-09-10T11:40:00-03:00',
    envios: [
      (
        proveedorId: 4,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(12, 6), (13, 10)],
        calificacion: (4, null)
      ),
      (
        proveedorId: 2,
        modalidad: 'retiro',
        puntoRetiroId: 1,
        estado: 'entregado',
        lineas: [(1, 3), (17, 2)],
        calificacion: (4, 'Retiro rápido, pero hubo fila en la bodega.')
      ),
    ],
  ),
  (
    id: 6,
    codigo: 'CM-10006',
    clienteId: 7,
    estado: 'entregada',
    medioPago: 'transferencia',
    creadaEn: '2026-09-16T08:55:00-03:00',
    envios: [
      (
        proveedorId: 2,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(5, 2), (11, 4)],
        calificacion: (5, 'Siempre puntuales.')
      ),
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(6, 2), (9, 24)],
        calificacion: (4, null)
      ),
    ],
  ),
  (
    id: 7,
    codigo: 'CM-10007',
    clienteId: 6,
    estado: 'entregada',
    medioPago: 'tarjeta',
    creadaEn: '2026-09-23T10:30:00-03:00',
    envios: [
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(1, 4), (10, 6), (4, 12)],
        calificacion: (5, 'Despacho gratis y a tiempo.')
      ),
      (
        proveedorId: 4,
        modalidad: 'retiro',
        puntoRetiroId: 2,
        estado: 'entregado',
        lineas: [(8, 6), (9, 36)],
        calificacion: (5, null)
      ),
    ],
  ),
  (
    id: 8,
    codigo: 'CM-10008',
    clienteId: 7,
    estado: 'entregada',
    medioPago: 'transferencia',
    creadaEn: '2026-09-29T16:10:00-03:00',
    envios: [
      (
        proveedorId: 2,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(3, 4), (16, 6)],
        calificacion: (4, 'Faltó una botella; la repusieron al día siguiente.')
      ),
      (
        proveedorId: 4,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(13, 12)],
        calificacion: (4, null)
      ),
    ],
  ),
  (
    id: 9,
    codigo: 'CM-10009',
    clienteId: 6,
    estado: 'entregada',
    medioPago: 'tarjeta',
    creadaEn: '2026-10-13T09:45:00-03:00',
    envios: [
      (
        proveedorId: 2,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(1, 5), (2, 4)],
        calificacion: (5, null)
      ),
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(11, 3), (5, 1)],
        calificacion: (3, 'Llegó al día siguiente de lo prometido.')
      ),
    ],
  ),
  (
    id: 10,
    codigo: 'CM-10010',
    clienteId: 7,
    estado: 'entregada',
    medioPago: 'transferencia',
    creadaEn: '2026-10-14T12:20:00-03:00',
    envios: [
      (
        proveedorId: 4,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(7, 6), (12, 4)],
        calificacion: null
      ),
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'entregado',
        lineas: [(15, 24), (14, 4)],
        calificacion: null
      ),
    ],
  ),
  (
    id: 11,
    codigo: 'CM-10011',
    clienteId: 6,
    estado: 'pagada',
    medioPago: 'tarjeta',
    creadaEn: '2026-10-21T18:05:00-03:00',
    envios: [
      (
        proveedorId: 3,
        modalidad: 'despacho',
        puntoRetiroId: null,
        estado: 'por_despachar',
        lineas: [(3, 2), (4, 6)],
        calificacion: null
      ),
    ],
  ),
];

// Carro abierto de El Fogón (seed.ts): (productoId, proveedorId, cantidad).
const seedCarroElFogon = [(9, 2, 24), (7, 4, 3), (15, 3, 10)];
