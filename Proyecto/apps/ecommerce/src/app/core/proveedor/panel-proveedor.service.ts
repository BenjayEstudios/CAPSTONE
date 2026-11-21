import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";

// Datos del panel del proveedor (KAN-101). Mismas formas que el contrato de
// la app movil (GET /estadisticas/proveedor/ventas y GET /alertas/proveedor).

export interface VentaSemana {
  semana: string; // lunes, AAAA-MM-DD
  envios: number;
  ventas: number;
  despacho: number;
  comision: number;
  neto: number;
}

export interface VentasProveedor {
  desde: string;
  hasta: string;
  totales: Omit<VentaSemana, "semana">;
  semanas: VentaSemana[];
  /** unidades = cajas vendidas. */
  productos: Array<{ productoId: number; nombre: string; unidades: number; ventas: number }>;
}

export interface AlertasProveedor {
  documentos: Array<{
    tipo: "carpeta_tributaria" | "resolucion_sanitaria" | "vigencia";
    venceEn: string | null;
    revision: "pendiente" | "aprobado" | "rechazado" | null;
    estado: "al_dia" | "por_vencer" | "vencido" | "falta";
    diasParaVencer: number | null;
  }>;
  stockBajo: Array<{ ofertaId: number; productoId: number; producto: string; cajasDisponibles: number; cajasIniciales: number | null }>;
  porCobrar: { entregadoSinLiquidar: number; liquidacionesPendientes: number; total: number; proximaLiquidacion: string };
  enviosPorDespachar: number;
  ofertas: { publicadas: number; borradores: number };
}

/** GET /proveedor/demanda (KAN-107). */
export interface DemandaProveedor {
  desde: string;
  hasta: string;
  inicioMes: string;
  productos: Array<{ ofertaId: number; productoId: number; producto: string; formato: string | null; vistas: number; clicks: number; conversion: number | null; cajasVendidas: number }>;
  restantes: Array<{ ofertaId: number; productoId: number; producto: string; formato: string | null; cajas: number; cajasInicioMes: number | null; porcentaje: number | null }>;
  potenciales: Array<{ comunaId: number; comuna: string; region: string; clientes: number; cubre: boolean }>;
}

export interface DireccionPerfil {
  calle: string;
  numero: string | null;
  complemento: string | null;
  comunaId: number;
  comuna: string;
  region: string;
}

/** GET /proveedor/perfil (KAN-108). */
export interface PerfilProveedor {
  id: number;
  razonSocial: string;
  rut: string;
  nombreFantasia: string | null;
  giro: string | null;
  emailContacto: string | null;
  telefono: string | null;
  direccion: DireccionPerfil | null;
  bodega: { id: number; nombre: string; horario: string | null; direccion: DireccionPerfil } | null;
  plazoEstandarHoras: number | null;
  plazoFueraRegionHoras: number | null;
  horaCorte: string | null;
  despachoGratisDesde: number | null;
  ofreceDespacho: boolean;
  ofreceRetiro: boolean;
  banco: string | null;
  cuentaBancaria: string | null;
  estado: "activa" | "en_revision" | "suspendida";
  comisionPct: number | null;
  entregasATiempoPct: number | null;
  creadaEn: string;
  regiones: string[];
  equipo: Array<{ nombre: string; email: string; telefono: string | null }>;
}

export interface NuevaDireccion {
  calle: string;
  numero: string | null;
  complemento: string | null;
  comunaId: number;
}

/** PATCH /proveedor/perfil: solo lo que cambio. */
export interface CambiosPerfil {
  nombreFantasia?: string;
  giro?: string | null;
  emailContacto?: string;
  telefono?: string | null;
  direccion?: NuevaDireccion;
  bodega?: NuevaDireccion & { nombre: string; horario: string | null };
  plazoEstandarHoras?: number;
  plazoFueraRegionHoras?: number | null;
  horaCorte?: string | null;
  despachoGratisDesde?: number | null;
  ofreceDespacho?: boolean;
  ofreceRetiro?: boolean;
  banco?: string | null;
  cuentaBancaria?: string | null;
}

/** Zona de despacho (KAN-109): una comuna, o toda la region si comunaId es null. */
export interface ZonaDespacho {
  id: number;
  comunaId: number | null;
  comuna: string | null;
  regionCodigo: string;
  region: string;
  costoDespacho: number;
  plazoHoras: number | null;
}

/** GET /proveedor/cobertura */
export interface CoberturaProveedor {
  horaCorte: string | null;
  despachoGratisDesde: number | null;
  plazoEstandarHoras: number | null;
  ofreceDespacho: boolean;
  ofreceRetiro: boolean;
  zonas: ZonaDespacho[];
}

export interface RegionCobertura {
  codigo: string;
  nombre: string;
  comunas: Array<{ id: number; nombre: string }>;
}

/** GET /proveedor/puntos-retiro */
export interface PuntoRetiroProveedor {
  id: number;
  nombre: string;
  horario: string | null;
  activo: boolean;
  usado: boolean;
  direccion: DireccionPerfil;
}

export type TipoDocumento = "carpeta_tributaria" | "resolucion_sanitaria" | "vigencia";

/** El documento vigente de un tipo (el ultimo subido). */
export interface DocumentoSubido {
  id: number;
  url: string;
  venceEn: string | null;
  vigencia: "al_dia" | "por_vencer" | "vencido";
  diasParaVencer: number | null;
  revisionEstado: "pendiente" | "aprobado" | "rechazado";
  motivoRechazo: string | null;
  revisadoEn: string | null;
}

/** GET /proveedor/documentos (KAN-110): uno por documento exigido. */
export interface DocumentoExigido {
  tipo: TipoDocumento;
  nombre: string;
  requiereVencimiento: boolean;
  estado: "al_dia" | "por_vencer" | "vencido" | "falta";
  actual: DocumentoSubido | null;
  anteriores: number;
}

@Injectable({ providedIn: "root" })
export class PanelProveedorService {
  private readonly api = inject(ApiClient);

  ventas(desde: string, hasta: string): Promise<VentasProveedor> {
    return firstValueFrom(this.api.get<VentasProveedor>(`/estadisticas/proveedor/ventas?desde=${desde}&hasta=${hasta}`));
  }

  /** Demanda y cobertura de los ultimos `dias` (KAN-107). */
  demanda(desde: string): Promise<DemandaProveedor> {
    return firstValueFrom(this.api.get<DemandaProveedor>(`/proveedor/demanda?desde=${desde}`));
  }

  // ---- Cobertura y puntos de retiro (KAN-109)
  cobertura(): Promise<CoberturaProveedor> {
    return firstValueFrom(this.api.get<CoberturaProveedor>("/proveedor/cobertura"));
  }

  regionesCobertura(): Promise<RegionCobertura[]> {
    return firstValueFrom(this.api.get<RegionCobertura[]>("/proveedor/cobertura/regiones"));
  }

  crearZona(z: { comunaId: number | null; regionCodigo: string; costoDespacho: number; plazoHoras: number | null }): Promise<{ id: number }> {
    return firstValueFrom(this.api.post<{ id: number }>("/proveedor/cobertura/zonas", z));
  }

  actualizarZona(id: number, c: { costoDespacho?: number; plazoHoras?: number | null }): Promise<ZonaDespacho> {
    return firstValueFrom(this.api.patch<ZonaDespacho>(`/proveedor/cobertura/zonas/${id}`, c));
  }

  eliminarZona(id: number): Promise<unknown> {
    return firstValueFrom(this.api.delete(`/proveedor/cobertura/zonas/${id}`));
  }

  puntosRetiro(): Promise<{ items: PuntoRetiroProveedor[] }> {
    return firstValueFrom(this.api.get<{ items: PuntoRetiroProveedor[] }>("/proveedor/puntos-retiro"));
  }

  crearPuntoRetiro(p: { nombre: string; horario: string | null; direccion: NuevaDireccion }): Promise<{ id: number }> {
    return firstValueFrom(this.api.post<{ id: number }>("/proveedor/puntos-retiro", p));
  }

  actualizarPuntoRetiro(id: number, c: { nombre?: string; horario?: string | null; activo?: boolean; direccion?: NuevaDireccion }): Promise<PuntoRetiroProveedor> {
    return firstValueFrom(this.api.patch<PuntoRetiroProveedor>(`/proveedor/puntos-retiro/${id}`, c));
  }

  eliminarPuntoRetiro(id: number): Promise<unknown> {
    return firstValueFrom(this.api.delete(`/proveedor/puntos-retiro/${id}`));
  }

  // ---- Documentos (KAN-110)
  documentos(): Promise<{ items: DocumentoExigido[] }> {
    return firstValueFrom(this.api.get<{ items: DocumentoExigido[] }>("/proveedor/documentos"));
  }

  /** El archivo va en multipart; tipo y vencimiento en la query. */
  subirDocumento(tipo: TipoDocumento, archivo: File, venceEn: string | null): Promise<DocumentoSubido & { tipo: TipoDocumento; nombre: string }> {
    const datos = new FormData();
    datos.append("archivo", archivo, archivo.name);
    const q = new URLSearchParams({ tipo });
    if (venceEn) q.set("venceEn", venceEn);
    return firstValueFrom(this.api.post(`/proveedor/documentos?${q}`, datos));
  }

  perfil(): Promise<PerfilProveedor> {
    return firstValueFrom(this.api.get<PerfilProveedor>("/proveedor/perfil"));
  }

  actualizarPerfil(cambios: CambiosPerfil): Promise<PerfilProveedor> {
    return firstValueFrom(this.api.patch<PerfilProveedor>("/proveedor/perfil", cambios));
  }

  alertas(): Promise<AlertasProveedor> {
    return firstValueFrom(this.api.get<AlertasProveedor>("/alertas/proveedor"));
  }
}
