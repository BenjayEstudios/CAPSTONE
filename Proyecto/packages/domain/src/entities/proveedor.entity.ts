import type { Organizacion, OrganizacionEstado } from "./organizacion.entity.js";

// Un proveedor es una Organizacion con tipo = "proveedor".
export type Proveedor = Organizacion & { tipo: "proveedor" };
export type ProveedorEstado = OrganizacionEstado;

export interface ResumenDocumentosProveedor {
  total: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
}

export interface ProveedorListado {
  id: number;
  razonSocial: string;
  nombreFantasia: string | null;
  rut: string;
  estado: ProveedorEstado;
  comisionPct: number | null;
  creadaEn: Date;
  documentos: ResumenDocumentosProveedor;
}
