// Copia, con los mismos IDs, de los datos de prueba de
// packages/infrastructure/src/db/seed que usan los datasources fake
// (USE_FAKES=true). Si cambia el seed, actualizar acá: los fakes deben
// devolver lo mismo que devolvería la API contra la base del equipo.

// CLAVE_PRUEBA en seed.ts: la comparten todos los usuarios.
const claveSeed = 'Cotizapp.2026';

typedef SeedOrganizacion = ({int id, String tipo, String nombre, String razonSocial, String estado});

const seedOrganizaciones = <SeedOrganizacion>[
  (id: 1, tipo: 'interna', nombre: 'Cotizapp', razonSocial: 'Cotizapp SpA', estado: 'activa'),
  (id: 2, tipo: 'proveedor', nombre: 'Los Andes Food Service', razonSocial: 'Distribuidora Los Andes Ltda.', estado: 'activa'),
  (id: 3, tipo: 'proveedor', nombre: 'Valle Central Mayorista', razonSocial: 'Comercial Valle Central SpA', estado: 'activa'),
  (id: 4, tipo: 'proveedor', nombre: 'FrigoSur', razonSocial: 'Frigorífico del Sur S.A.', estado: 'activa'),
  (id: 5, tipo: 'proveedor', nombre: 'Las Palmas', razonSocial: 'Agrícola Las Palmas Ltda.', estado: 'en_revision'),
  (id: 6, tipo: 'cliente', nombre: 'El Fogón', razonSocial: 'Restaurante El Fogón Ltda.', estado: 'activa'),
  (id: 7, tipo: 'cliente', nombre: 'Dulce Hogar', razonSocial: 'Pastelería Dulce Hogar SpA', estado: 'activa'),
];

// rol = codigo de la tabla rol (catalogo.ts).
typedef SeedUsuario = ({int id, int organizacionId, String rol, String nombre, String email, String estado});

const seedUsuarios = <SeedUsuario>[
  (id: 1, organizacionId: 1, rol: 'admin_general', nombre: 'Administrador Cotizapp', email: 'admin@cotizapp.test', estado: 'activo'),
  (id: 2, organizacionId: 1, rol: 'editor_catalogo', nombre: 'Editor de Catálogo', email: 'catalogo@cotizapp.test', estado: 'activo'),
  (id: 3, organizacionId: 1, rol: 'soporte', nombre: 'Soporte Cotizapp', email: 'soporte@cotizapp.test', estado: 'activo'),
  (id: 4, organizacionId: 2, rol: 'proveedor', nombre: 'Ventas Los Andes', email: 'ventas@losandes.test', estado: 'activo'),
  (id: 5, organizacionId: 3, rol: 'proveedor', nombre: 'Pedidos Valle Central', email: 'pedidos@vallecentral.test', estado: 'activo'),
  (id: 6, organizacionId: 4, rol: 'proveedor', nombre: 'Comercial FrigoSur', email: 'comercial@frigosur.test', estado: 'activo'),
  (id: 7, organizacionId: 5, rol: 'proveedor', nombre: 'Contacto Las Palmas', email: 'contacto@laspalmas.test', estado: 'invitado'),
  (id: 8, organizacionId: 6, rol: 'comprador', nombre: 'Compras El Fogón', email: 'compras@elfogon.test', estado: 'activo'),
  (id: 9, organizacionId: 7, rol: 'comprador', nombre: 'Compras Dulce Hogar', email: 'compras@dulcehogar.test', estado: 'activo'),
];

SeedOrganizacion seedOrganizacion(int id) => seedOrganizaciones.firstWhere((o) => o.id == id);

// --- Catálogo (catalogo.ts) ---

typedef SeedCategoria = ({int id, int? padreId, String nombre, String slug, int orden});

const seedCategorias = <SeedCategoria>[
  (id: 1, padreId: null, nombre: 'Abarrotes', slug: 'abarrotes', orden: 1),
  (id: 2, padreId: null, nombre: 'Lácteos y huevos', slug: 'lacteos-y-huevos', orden: 2),
  (id: 3, padreId: null, nombre: 'Carnes', slug: 'carnes', orden: 3),
  (id: 4, padreId: null, nombre: 'Frutas y verduras', slug: 'frutas-y-verduras', orden: 4),
  (id: 5, padreId: null, nombre: 'Bebidas', slug: 'bebidas', orden: 5),
  (id: 6, padreId: null, nombre: 'Panadería y pastelería', slug: 'panaderia-y-pasteleria', orden: 6),
  (id: 7, padreId: null, nombre: 'Aseo y desechables', slug: 'aseo-y-desechables', orden: 7),
  (id: 8, padreId: 1, nombre: 'Aceites', slug: 'aceites', orden: 1),
  (id: 9, padreId: 1, nombre: 'Arroz y legumbres', slug: 'arroz-y-legumbres', orden: 2),
  (id: 10, padreId: 2, nombre: 'Quesos', slug: 'quesos', orden: 1),
  (id: 11, padreId: 2, nombre: 'Leches y cremas', slug: 'leches-y-cremas', orden: 2),
  (id: 12, padreId: 3, nombre: 'Vacuno', slug: 'vacuno', orden: 1),
  (id: 13, padreId: 3, nombre: 'Pollo', slug: 'pollo', orden: 2),
  (id: 14, padreId: 6, nombre: 'Harinas', slug: 'harinas', orden: 1),
  (id: 15, padreId: 6, nombre: 'Azúcar y endulzantes', slug: 'azucar-y-endulzantes', orden: 2),
];

// precioReferencia en CLP por unidad de venta (el "formato").
typedef SeedProducto = ({
  int id,
  int categoriaId,
  String sku,
  String nombre,
  String? marca,
  String formato,
  double contenido,
  String unidad,
  int precioReferencia,
});

const seedProductos = <SeedProducto>[
  (
    id: 1,
    categoriaId: 8,
    sku: 'ACE-0001',
    nombre: 'Aceite vegetal maravilla',
    marca: 'Belmont',
    formato: 'Bidón 5 L',
    contenido: 5,
    unidad: 'L',
    precioReferencia: 12990
  ),
  (
    id: 2,
    categoriaId: 8,
    sku: 'ACE-0002',
    nombre: 'Aceite de oliva extra virgen',
    marca: 'Olave',
    formato: 'Botella 1 L',
    contenido: 1,
    unidad: 'L',
    precioReferencia: 9990
  ),
  (
    id: 3,
    categoriaId: 9,
    sku: 'ARR-0001',
    nombre: 'Arroz grado 1 grano largo',
    marca: 'Tucapel',
    formato: 'Saco 5 kg',
    contenido: 5,
    unidad: 'kg',
    precioReferencia: 7490
  ),
  (id: 4, categoriaId: 9, sku: 'LEG-0001', nombre: 'Lentejas 6 mm', marca: null, formato: 'Bolsa 1 kg', contenido: 1, unidad: 'kg', precioReferencia: 2690),
  (
    id: 5,
    categoriaId: 14,
    sku: 'HAR-0001',
    nombre: 'Harina sin polvos de hornear',
    marca: 'Selecta',
    formato: 'Saco 25 kg',
    contenido: 25,
    unidad: 'kg',
    precioReferencia: 21990
  ),
  (
    id: 6,
    categoriaId: 15,
    sku: 'AZU-0001',
    nombre: 'Azúcar granulada',
    marca: 'Iansa',
    formato: 'Saco 25 kg',
    contenido: 25,
    unidad: 'kg',
    precioReferencia: 27990
  ),
  (
    id: 7,
    categoriaId: 10,
    sku: 'QUE-0001',
    nombre: 'Queso gauda laminado',
    marca: 'Colún',
    formato: 'Paquete 1 kg',
    contenido: 1,
    unidad: 'kg',
    precioReferencia: 10990
  ),
  (
    id: 8,
    categoriaId: 10,
    sku: 'QUE-0002',
    nombre: 'Queso mozzarella en barra',
    marca: 'Soprole',
    formato: 'Barra 1 kg',
    contenido: 1,
    unidad: 'kg',
    precioReferencia: 8990
  ),
  (id: 9, categoriaId: 11, sku: 'LEC-0001', nombre: 'Leche entera', marca: 'Colún', formato: 'Caja 1 L', contenido: 1, unidad: 'L', precioReferencia: 1190),
  (
    id: 10,
    categoriaId: 11,
    sku: 'CRE-0001',
    nombre: 'Crema para batir 35% MG',
    marca: 'Soprole',
    formato: 'Caja 1 L',
    contenido: 1,
    unidad: 'L',
    precioReferencia: 5490
  ),
  (
    id: 11,
    categoriaId: 2,
    sku: 'HUE-0001',
    nombre: 'Huevos blancos extra',
    marca: null,
    formato: 'Bandeja 30 un',
    contenido: 30,
    unidad: 'unidad',
    precioReferencia: 6990
  ),
  (
    id: 12,
    categoriaId: 12,
    sku: 'VAC-0001',
    nombre: 'Posta negra de vacuno',
    marca: null,
    formato: 'Envasado al vacío 1 kg',
    contenido: 1,
    unidad: 'kg',
    precioReferencia: 11990
  ),
  (
    id: 13,
    categoriaId: 13,
    sku: 'POL-0001',
    nombre: 'Pechuga de pollo deshuesada IQF',
    marca: null,
    formato: 'Bolsa 1 kg',
    contenido: 1,
    unidad: 'kg',
    precioReferencia: 6490
  ),
  (
    id: 14,
    categoriaId: 4,
    sku: 'FRU-0001',
    nombre: 'Palta Hass calibre 18',
    marca: null,
    formato: 'Granel 1 kg',
    contenido: 1,
    unidad: 'kg',
    precioReferencia: 4990
  ),
  (
    id: 15,
    categoriaId: 4,
    sku: 'VER-0001',
    nombre: 'Tomate larga vida',
    marca: null,
    formato: 'Granel 1 kg',
    contenido: 1,
    unidad: 'kg',
    precioReferencia: 1490
  ),
  (
    id: 16,
    categoriaId: 5,
    sku: 'BEB-0001',
    nombre: 'Bebida cola',
    marca: 'Coca-Cola',
    formato: 'Botella desechable 3 L',
    contenido: 3,
    unidad: 'L',
    precioReferencia: 3290
  ),
  (
    id: 17,
    categoriaId: 7,
    sku: 'ASE-0001',
    nombre: 'Guantes de nitrilo talla M',
    marca: null,
    formato: 'Caja 100 un',
    contenido: 100,
    unidad: 'unidad',
    precioReferencia: 7990
  ),
];

// Datos comerciales de cada proveedor (PROVEEDOR y organizacion en seed.ts).
// costoDespachoRM = tarifa de proveedor_cobertura en la RM, donde están los
// dos clientes del seed.
typedef SeedProveedor = ({
  int id,
  int plazoHoras,
  int despachoGratisDesde,
  int costoDespachoRM,
  String modalidad,
  double entregasATiempoPct,
  String horaCorte,
});

const seedProveedores = <SeedProveedor>[
  (id: 2, plazoHoras: 24, despachoGratisDesde: 150000, costoDespachoRM: 4990, modalidad: 'ambos', entregasATiempoPct: 96.5, horaCorte: '14:00'),
  (id: 3, plazoHoras: 48, despachoGratisDesde: 200000, costoDespachoRM: 5990, modalidad: 'despacho', entregasATiempoPct: 91.2, horaCorte: '12:00'),
  (id: 4, plazoHoras: 24, despachoGratisDesde: 120000, costoDespachoRM: 6990, modalidad: 'ambos', entregasATiempoPct: 94.0, horaCorte: '13:00'),
  (id: 5, plazoHoras: 48, despachoGratisDesde: 80000, costoDespachoRM: 2990, modalidad: 'despacho', entregasATiempoPct: 0.0, horaCorte: '11:00'),
];

SeedProveedor seedProveedor(int id) => seedProveedores.firstWhere((p) => p.id == id);

typedef SeedOferta = ({
  int id,
  int productoId,
  int proveedorId,
  int precioUnitario,
  int unidadesPorCaja,
  int cajasDisponibles,
  int minimoCompra,
  int plazoHoras,
  String modalidadEntrega,
  String estado,
});

// [productoId, proveedorId, precioUnitario, unidadesPorCaja, estado] en el
// mismo orden que OFERTAS de seed.ts: el id es la posición + 1.
const _ofertas = <(int, int, int, int, String)>[
  (1, 2, 12490, 4, 'publicada'),
  (1, 3, 12890, 4, 'publicada'),
  (2, 2, 9490, 12, 'publicada'),
  (2, 3, 10290, 12, 'publicada'),
  (3, 2, 7190, 4, 'publicada'),
  (3, 3, 6990, 4, 'publicada'),
  (4, 2, 2590, 10, 'publicada'),
  (4, 3, 2490, 10, 'publicada'),
  (5, 3, 20990, 1, 'publicada'),
  (5, 2, 22490, 1, 'publicada'),
  (6, 3, 26990, 1, 'publicada'),
  (6, 2, 27490, 1, 'publicada'),
  (7, 4, 10490, 6, 'publicada'),
  (7, 2, 11290, 6, 'publicada'),
  (8, 4, 8590, 6, 'publicada'),
  (8, 3, 9190, 6, 'publicada'),
  (9, 2, 1090, 12, 'publicada'),
  (9, 3, 1150, 12, 'publicada'),
  (9, 4, 1120, 12, 'publicada'),
  (10, 3, 5190, 12, 'publicada'),
  (10, 4, 5390, 12, 'publicada'),
  (11, 2, 6590, 6, 'publicada'),
  (11, 3, 6890, 6, 'publicada'),
  (12, 4, 11490, 10, 'publicada'),
  (12, 2, 12490, 10, 'publicada'),
  (13, 4, 5990, 10, 'publicada'),
  (13, 2, 6290, 10, 'publicada'),
  (14, 3, 4790, 10, 'publicada'),
  (14, 5, 7490, 10, 'borrador'),
  (15, 3, 1390, 18, 'publicada'),
  (15, 5, 1290, 18, 'borrador'),
  (16, 2, 3090, 6, 'publicada'),
  (16, 3, 3190, 6, 'pausada'),
  (17, 2, 7590, 10, 'publicada'),
];

// Mismas fórmulas de stock que seed.ts (cajasIniciales y cajasDisponibles).
final List<SeedOferta> seedOfertas = [
  for (final (i, (productoId, proveedorId, precio, porCaja, estado)) in _ofertas.indexed)
    (
      id: i + 1,
      productoId: productoId,
      proveedorId: proveedorId,
      precioUnitario: precio,
      unidadesPorCaja: porCaja,
      cajasDisponibles: (30 + ((i + 1) * 17) % 70) - (((i + 1) * 7) % 20),
      minimoCompra: 1,
      plazoHoras: seedProveedor(proveedorId).plazoHoras,
      modalidadEntrega: seedProveedor(proveedorId).modalidad,
      estado: estado,
    ),
];

// --- Calificaciones (KAN-142): una por envío entregado y calificado ---

typedef SeedCalificacion = ({String ordenCodigo, int proveedorId, int clienteId, int puntaje, String? comentario});

const seedCalificaciones = <SeedCalificacion>[
  (ordenCodigo: 'CM-10001', proveedorId: 2, clienteId: 6, puntaje: 5, comentario: 'Llegó todo antes de la hora de corte y bien embalado.'),
  (ordenCodigo: 'CM-10001', proveedorId: 4, clienteId: 6, puntaje: 4, comentario: 'Buena cadena de frío; el camión llegó una hora tarde.'),
  (ordenCodigo: 'CM-10003', proveedorId: 2, clienteId: 6, puntaje: 5, comentario: null),
  (ordenCodigo: 'CM-10003', proveedorId: 3, clienteId: 6, puntaje: 4, comentario: 'Paltas en buen punto.'),
  (ordenCodigo: 'CM-10004', proveedorId: 3, clienteId: 7, puntaje: 3, comentario: 'Llegaron 4 kg de tomate machucados, reclamo resuelto con nota de crédito.'),
  (ordenCodigo: 'CM-10004', proveedorId: 4, clienteId: 7, puntaje: 5, comentario: 'Crema con buena fecha de vencimiento.'),
  (ordenCodigo: 'CM-10005', proveedorId: 4, clienteId: 6, puntaje: 4, comentario: null),
  (ordenCodigo: 'CM-10005', proveedorId: 2, clienteId: 6, puntaje: 4, comentario: 'Retiro rápido, pero hubo fila en la bodega.'),
  (ordenCodigo: 'CM-10006', proveedorId: 2, clienteId: 7, puntaje: 5, comentario: 'Siempre puntuales.'),
  (ordenCodigo: 'CM-10006', proveedorId: 3, clienteId: 7, puntaje: 4, comentario: null),
  (ordenCodigo: 'CM-10007', proveedorId: 3, clienteId: 6, puntaje: 5, comentario: 'Despacho gratis y a tiempo.'),
  (ordenCodigo: 'CM-10007', proveedorId: 4, clienteId: 6, puntaje: 5, comentario: null),
  (ordenCodigo: 'CM-10008', proveedorId: 2, clienteId: 7, puntaje: 4, comentario: 'Faltó una botella; la repusieron al día siguiente.'),
  (ordenCodigo: 'CM-10008', proveedorId: 4, clienteId: 7, puntaje: 4, comentario: null),
  (ordenCodigo: 'CM-10009', proveedorId: 2, clienteId: 6, puntaje: 5, comentario: null),
  (ordenCodigo: 'CM-10009', proveedorId: 3, clienteId: 6, puntaje: 3, comentario: 'Llegó al día siguiente de lo prometido.'),
];
