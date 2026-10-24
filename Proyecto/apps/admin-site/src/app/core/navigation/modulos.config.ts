// Mapeo modulo -> permiso en un solo lugar. Un modulo con `permiso: null`
// siempre es visible; el resto se muestra (y su ruta se habilita) solo si
// el permiso del usuario es "parcial" o "total".
export interface ModuloAdmin {
  path: string;
  label: string;
  permiso: string | null;
}

export const MODULOS: readonly ModuloAdmin[] = [
  { path: "dashboard", label: "Dashboard", permiso: null },
  { path: "catalogo-maestro", label: "Catálogo maestro", permiso: "crear_producto" },
  { path: "categorias", label: "Categorías", permiso: "crear_producto" },
  { path: "moderacion", label: "Moderación", permiso: "aprobar_proveedor" },
  { path: "proveedores", label: "Proveedores", permiso: "aprobar_proveedor" },
  { path: "ordenes", label: "Órdenes", permiso: "ver_todas_ordenes" },
  { path: "reembolsos", label: "Reembolsos", permiso: "emitir_reembolso" },
  { path: "usuarios", label: "Usuarios", permiso: "crear_usuario" },
  { path: "roles-permisos", label: "Roles y permisos", permiso: "cambiar_permisos" },
  { path: "liquidaciones", label: "Liquidaciones", permiso: "liquidar_proveedor" },
  { path: "auditoria", label: "Auditoría", permiso: "ver_auditoria" }
];

export const RUTA_INICIO = "/dashboard";
