export type OrganizacionTipo = "cliente" | "proveedor" | "interna";
export type OrganizacionEstado = "activa" | "en_revision" | "suspendida";

// Entidad de dominio: forma pura de la organizacion, sin nada de Drizzle/MySQL.
// Ver DataBase/dbDiagram.sql -> Table organizacion. Los campos "solo proveedor"
// son null cuando tipo = cliente | interna. Decimales (comision_pct,
// entregas_a_tiempo_pct) como number y hora_corte como "HH:MM:SS".
export interface Organizacion {
  id: number;
  tipo: OrganizacionTipo;
  razonSocial: string;
  rut: string;
  nombreFantasia: string | null;
  giro: string | null;
  emailContacto: string | null;
  telefono: string | null;
  direccionId: number | null;
  estado: OrganizacionEstado;
  comisionPct: number | null;
  plazoEstandarHoras: number | null;
  plazoFueraRegionHoras: number | null;
  horaCorte: string | null;
  despachoGratisDesde: number | null;
  ofreceDespacho: boolean | null;
  ofreceRetiro: boolean | null;
  entregasATiempoPct: number | null;
  banco: string | null;
  cuentaBancaria: string | null;
  creadaEn: Date;
}
