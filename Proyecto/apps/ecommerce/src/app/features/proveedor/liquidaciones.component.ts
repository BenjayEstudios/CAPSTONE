import { Component, inject, signal } from "@angular/core";
import { AlertasProveedor, Liquidacion, LiquidacionDetalle, PanelProveedorService } from "../../core/proveedor/panel-proveedor.service";
import { formatearClp } from "../../shared/formato";

const TAMANO = 20;
const DIA_MES = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
const DIA_SEMANA = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const sinPunto = (s: string) => s.replace(".", "");
const ymd = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** "12 al 18 oct" o "28 sept al 4 oct". */
export function textoPeriodo(desde: string, hasta: string): string {
  const a = ymd(desde);
  const b = ymd(hasta);
  const inicio = a.getUTCMonth() === b.getUTCMonth() ? String(a.getUTCDate()) : sinPunto(DIA_MES.format(a));
  return `${inicio} al ${sinPunto(DIA_MES.format(b))}`;
}

/** Fecha de pago: el dia calendario en Chile (se registra a mediodia UTC). */
export function textoFechaPago(pagadaEn: string | null): string {
  return pagadaEn ? sinPunto(DIA_MES.format(new Date(pagadaEn))) : "—";
}

// /proveedor/liquidaciones (KAN-111): lo que Cotizapp le debe al proveedor y
// sus cortes semanales. Arriba, "Por cobrar": lo entregado que aun no entra
// en una liquidacion mas las liquidaciones sin pagar (GET /alertas/proveedor).
// Abajo, la lista (periodo, bruto, comision, neto, estado, fecha de pago) y,
// al abrir una, los envios que incluye (GET /liquidaciones/mias/:id).
@Component({
  selector: "app-liquidaciones-proveedor",
  standalone: true,
  templateUrl: "./liquidaciones.component.html",
  styleUrl: "./liquidaciones.component.css"
})
export class LiquidacionesProveedorComponent {
  private readonly panel = inject(PanelProveedorService);

  readonly porCobrar = signal<AlertasProveedor["porCobrar"] | null>(null);
  readonly liquidaciones = signal<Liquidacion[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly cargandoMas = signal(false);
  readonly abierta = signal<number | null>(null);
  readonly detalle = signal<LiquidacionDetalle | null>(null);
  readonly estadoDetalle = signal<"cargando" | "ok" | "error">("cargando");

  readonly clp = formatearClp;
  readonly periodo = textoPeriodo;
  readonly fechaPago = textoFechaPago;
  readonly corta = (iso: string) => sinPunto(DIA_MES.format(new Date(iso)));
  readonly diaSemana = (iso: string) => DIA_SEMANA.format(ymd(iso));

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      const [alertas, lista] = await Promise.all([this.panel.alertas().catch(() => null), this.panel.liquidaciones(1, TAMANO)]);
      this.porCobrar.set(alertas?.porCobrar ?? null);
      this.liquidaciones.set(lista.items);
      this.total.set(lista.total);
      this.pagina.set(1);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  async verMas(): Promise<void> {
    if (this.cargandoMas()) return;
    this.cargandoMas.set(true);
    try {
      const r = await this.panel.liquidaciones(this.pagina() + 1, TAMANO);
      const vistas = new Set(this.liquidaciones().map((l) => l.id));
      this.liquidaciones.update((l) => [...l, ...r.items.filter((x) => !vistas.has(x.id))]);
      this.total.set(r.total);
      this.pagina.update((p) => p + 1);
    } finally {
      this.cargandoMas.set(false);
    }
  }

  async alternar(l: Liquidacion): Promise<void> {
    if (this.abierta() === l.id) {
      this.abierta.set(null);
      return;
    }
    this.abierta.set(l.id);
    this.detalle.set(null);
    this.estadoDetalle.set("cargando");
    try {
      const d = await this.panel.liquidacion(l.id);
      if (this.abierta() === l.id) {
        this.detalle.set(d);
        this.estadoDetalle.set("ok");
      }
    } catch {
      if (this.abierta() === l.id) this.estadoDetalle.set("error");
    }
  }
}
