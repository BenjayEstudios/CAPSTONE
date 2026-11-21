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

  alertas(): Promise<AlertasProveedor> {
    return firstValueFrom(this.api.get<AlertasProveedor>("/alertas/proveedor"));
  }
}
