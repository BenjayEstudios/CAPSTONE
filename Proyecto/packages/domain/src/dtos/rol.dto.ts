import { z } from "zod";

// Catalogo de codigos de permiso validos (nota de Table rol en DataBase/dbDiagram.sql).
export const CATALOGO_PERMISOS = [
  { codigo: "crear_producto", etiqueta: "Crear y editar productos", descripcion: "Gestionar el catalogo maestro y las categorias" },
  { codigo: "cargar_imagenes", etiqueta: "Cargar imagenes de producto", descripcion: "Subir y reemplazar imagenes de productos" },
  { codigo: "aprobar_proveedor", etiqueta: "Aprobar proveedores", descripcion: "Revisar documentos, aprobar, rechazar y suspender proveedores" },
  { codigo: "ver_todas_ordenes", etiqueta: "Ver todas las ordenes", descripcion: "Consultar las ordenes de toda la plataforma" },
  { codigo: "ver_ordenes_propias", etiqueta: "Ver ordenes propias", descripcion: "Consultar solo las ordenes de su organizacion" },
  { codigo: "publicar_precio_stock", etiqueta: "Publicar precio y stock", descripcion: "Publicar y actualizar ofertas de precio y stock" },
  { codigo: "emitir_reembolso", etiqueta: "Emitir reembolsos", descripcion: "Aprobar y emitir reembolsos a compradores" },
  { codigo: "liquidar_proveedor", etiqueta: "Liquidar proveedores", descripcion: "Generar y pagar liquidaciones a proveedores" },
  { codigo: "crear_usuario", etiqueta: "Crear usuarios", descripcion: "Invitar y administrar usuarios" },
  { codigo: "cambiar_permisos", etiqueta: "Cambiar permisos", descripcion: "Editar la matriz de roles y permisos" },
  { codigo: "ver_auditoria", etiqueta: "Ver auditoria", descripcion: "Consultar el registro de auditoria" }
] as const;

export const CODIGOS_PERMISO: string[] = CATALOGO_PERMISOS.map((p) => p.codigo);
export const NIVELES_PERMISO = ["ninguno", "parcial", "total"] as const;

export const actualizarPermisosSchema = z.object({
  permisos: z.record(z.string(), z.enum(NIVELES_PERMISO, { message: "Nivel invalido (ninguno|parcial|total)" }))
});
export type ActualizarPermisosDto = z.infer<typeof actualizarPermisosSchema>;
