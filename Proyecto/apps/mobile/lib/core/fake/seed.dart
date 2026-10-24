// Copia, con los mismos IDs, de los datos de prueba de
// packages/infrastructure/src/db/seed que usan los datasources fake
// (USE_FAKES=true). Si cambia el seed, actualizar acá: los fakes deben
// devolver lo mismo que devolvería la API contra la base del equipo.

// CLAVE_PRUEBA en seed.ts: la comparten todos los usuarios.
const claveSeed = 'Cotizapp.2026';

typedef SeedOrganizacion = ({int id, String tipo, String nombre, String razonSocial, String estado});

const seedOrganizaciones = <SeedOrganizacion>[
  (id: 1, tipo: 'interna', nombre: 'Cotizapp', razonSocial: 'Cotizapp SpA', estado: 'activa'),
  (
    id: 2,
    tipo: 'proveedor',
    nombre: 'Los Andes Food Service',
    razonSocial: 'Distribuidora Los Andes Ltda.',
    estado: 'activa'
  ),
  (
    id: 3,
    tipo: 'proveedor',
    nombre: 'Valle Central Mayorista',
    razonSocial: 'Comercial Valle Central SpA',
    estado: 'activa'
  ),
  (id: 4, tipo: 'proveedor', nombre: 'FrigoSur', razonSocial: 'Frigorífico del Sur S.A.', estado: 'activa'),
  (id: 5, tipo: 'proveedor', nombre: 'Las Palmas', razonSocial: 'Agrícola Las Palmas Ltda.', estado: 'en_revision'),
  (id: 6, tipo: 'cliente', nombre: 'El Fogón', razonSocial: 'Restaurante El Fogón Ltda.', estado: 'activa'),
  (id: 7, tipo: 'cliente', nombre: 'Dulce Hogar', razonSocial: 'Pastelería Dulce Hogar SpA', estado: 'activa'),
];

// rol = codigo de la tabla rol (catalogo.ts).
typedef SeedUsuario = ({int id, int organizacionId, String rol, String nombre, String email, String estado});

const seedUsuarios = <SeedUsuario>[
  (
    id: 1,
    organizacionId: 1,
    rol: 'admin_general',
    nombre: 'Administrador Cotizapp',
    email: 'admin@cotizapp.test',
    estado: 'activo'
  ),
  (
    id: 2,
    organizacionId: 1,
    rol: 'editor_catalogo',
    nombre: 'Editor de Catálogo',
    email: 'catalogo@cotizapp.test',
    estado: 'activo'
  ),
  (
    id: 3,
    organizacionId: 1,
    rol: 'soporte',
    nombre: 'Soporte Cotizapp',
    email: 'soporte@cotizapp.test',
    estado: 'activo'
  ),
  (
    id: 4,
    organizacionId: 2,
    rol: 'proveedor',
    nombre: 'Ventas Los Andes',
    email: 'ventas@losandes.test',
    estado: 'activo'
  ),
  (
    id: 5,
    organizacionId: 3,
    rol: 'proveedor',
    nombre: 'Pedidos Valle Central',
    email: 'pedidos@vallecentral.test',
    estado: 'activo'
  ),
  (
    id: 6,
    organizacionId: 4,
    rol: 'proveedor',
    nombre: 'Comercial FrigoSur',
    email: 'comercial@frigosur.test',
    estado: 'activo'
  ),
  (
    id: 7,
    organizacionId: 5,
    rol: 'proveedor',
    nombre: 'Contacto Las Palmas',
    email: 'contacto@laspalmas.test',
    estado: 'invitado'
  ),
  (
    id: 8,
    organizacionId: 6,
    rol: 'comprador',
    nombre: 'Compras El Fogón',
    email: 'compras@elfogon.test',
    estado: 'activo'
  ),
  (
    id: 9,
    organizacionId: 7,
    rol: 'comprador',
    nombre: 'Compras Dulce Hogar',
    email: 'compras@dulcehogar.test',
    estado: 'activo'
  ),
];

SeedOrganizacion seedOrganizacion(int id) => seedOrganizaciones.firstWhere((o) => o.id == id);
