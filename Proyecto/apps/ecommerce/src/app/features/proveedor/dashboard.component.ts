import { Component, computed, inject, InjectionToken, signal } from "@angular/core";
import { AlertasProveedor, PanelProveedorService, VentasProveedor } from "../../core/proveedor/panel-proveedor.service";
import { formatearClp, formatearEntero } from "../../shared/formato";
import { rangosDashboard, semanaIso, textoVariacion, ticketPromedio, ultimas12 } from "./dashboard.calculo";

/** La fecha de hoy. Un token para que los tests la fijen antes de crear el componente. */
export const RELOJ = new InjectionToken<() => Date>("RELOJ", { providedIn: "root", factory: () => () => new Date() });

const MES = new Intl.DateTimeFormat("es-CL", { month: "long", timeZone: "UTC" });
const DIA_MES = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", timeZone: "UTC" });
const DIA_SEMANA = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const CORTA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });

const DOCUMENTOS: Record<string, string> = {
  carpeta_tributaria: "Carpeta tributaria",
  resolucion_sanitaria: "Resolución sanitaria",
  vigencia: "Certificado de vigencia"
};

export interface Alerta {
  etiqueta: string;
  tono: "urgente" | "aviso" | "info";
  texto: string;
}

const fecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Lo que va en "Requiere atencion", de lo mas urgente a lo informativo. */
export function armarAlertas(a: AlertasProveedor): Alerta[] {
  const alertas: Alerta[] = [];
  for (const d of a.documentos) {
    const nombre = DOCUMENTOS[d.tipo] ?? d.tipo;
    if (d.estado === "vencido") alertas.push({ etiqueta: "Documento", tono: "urgente", texto: `${nombre}: venció el ${DIA_MES.format(fecha(d.venceEn!))}. Súbela de nuevo para seguir vendiendo.` });
    else if (d.estado === "falta") alertas.push({ etiqueta: "Documento", tono: "urgente", texto: `${nombre}: todavía no la subes.` });
    else if (d.revision === "rechazado") alertas.push({ etiqueta: "Documento", tono: "urgente", texto: `${nombre}: el equipo de Cotizapp la rechazó. Revisa el motivo y súbela de nuevo.` });
    else if (d.estado === "por_vencer") alertas.push({ etiqueta: "Documento", tono: "aviso", texto: `${nombre}: vence en ${d.diasParaVencer} ${d.diasParaVencer === 1 ? "día" : "días"} (${DIA_MES.format(fecha(d.venceEn!))}).` });
  }
  for (const s of a.stockBajo) {
    alertas.push({
      etiqueta: "Stock bajo",
      tono: s.cajasDisponibles === 0 ? "urgente" : "aviso",
      texto: s.cajasDisponibles === 0 ? `${s.producto}: sin stock; los compradores ya no pueden pedirlo.` : `${s.producto}: quedan ${s.cajasDisponibles} ${s.cajasDisponibles === 1 ? "caja" : "cajas"}.`
    });
  }
  if (a.enviosPorDespachar > 0) {
    alertas.push({ etiqueta: "Órdenes", tono: "aviso", texto: `${a.enviosPorDespachar} ${a.enviosPorDespachar === 1 ? "envío pagado espera" : "envíos pagados esperan"} que lo prepares.` });
  }
  if (a.ofertas.borradores > 0) {
    alertas.push({ etiqueta: "Borrador", tono: "info", texto: `${a.ofertas.borradores} ${a.ofertas.borradores === 1 ? "oferta está" : "ofertas están"} en borrador, sin publicar.` });
  }
  if (a.porCobrar.total > 0) {
    alertas.push({ etiqueta: "Cobro", tono: "info", texto: `${formatearClp(a.porCobrar.total)} por cobrar. Próxima liquidación: ${DIA_SEMANA.format(fecha(a.porCobrar.proximaLiquidacion))}.` });
  }
  return alertas;
}

// Inicio del panel del proveedor (KAN-101): KPIs del mes contra el mismo
// tramo del mes anterior, venta semanal de las ultimas 12 semanas, productos
// mas vendidos (cajas y monto) y lo que requiere atencion.
@Component({
  selector: "app-dashboard-proveedor",
  standalone: true,
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css"
})
export class DashboardProveedorComponent {
  private readonly panel = inject(PanelProveedorService);
  private readonly hoy = inject(RELOJ);

  readonly mes = signal<VentasProveedor | null>(null);
  readonly anterior = signal<VentasProveedor | null>(null);
  readonly semanas = signal<VentasProveedor | null>(null);
  readonly alertas = signal<AlertasProveedor | null>(null);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");

  readonly rangos = computed(() => rangosDashboard(this.hoy()));
  readonly nombreMes = computed(() => MES.format(fecha(this.rangos().mes.desde)));
  readonly nombreMesAnterior = computed(() => MES.format(fecha(this.rangos().mesAnterior.desde)));
  readonly diaDeHoy = computed(() => DIA_MES.format(fecha(this.rangos().mes.hasta)));

  readonly kpis = computed(() => {
    const m = this.mes();
    const p = this.anterior();
    const a = this.alertas();
    if (!m || !p || !a) return [];
    const ant = this.nombreMesAnterior();
    return [
      { etiqueta: "Venta del mes", valor: formatearClp(m.totales.ventas), detalle: textoVariacion(m.totales.ventas, p.totales.ventas, ant) },
      { etiqueta: "Por despachar", valor: formatearEntero(a.enviosPorDespachar), detalle: a.enviosPorDespachar === 1 ? "envío de una orden pagada" : "envíos de órdenes pagadas" },
      { etiqueta: "Ticket promedio", valor: formatearClp(ticketPromedio(m)), detalle: textoVariacion(ticketPromedio(m), ticketPromedio(p), ant) },
      {
        etiqueta: "Productos publicados",
        valor: formatearEntero(a.ofertas.publicadas),
        detalle: a.ofertas.borradores ? `${a.ofertas.borradores} en borrador sin publicar` : "ninguno en borrador"
      }
    ];
  });

  /** Barras del grafico: alto relativo a la semana mas alta. */
  readonly barras = computed(() => {
    const s = this.semanas();
    if (!s) return [];
    const serie = ultimas12(s.semanas);
    const max = Math.max(...serie.map((x) => x.ventas), 1);
    return serie.map((x, i) => ({
      ...x,
      etiqueta: `S${semanaIso(x.semana)}`,
      desde: CORTA.format(fecha(x.semana)),
      alto: x.ventas ? Math.max(2, Math.round((x.ventas / max) * 100)) : 0,
      actual: i === serie.length - 1
    }));
  });
  readonly maximo = computed(() => Math.max(...this.barras().map((b) => b.ventas), 0));
  readonly productos = computed(() => this.semanas()?.productos.slice(0, 5) ?? []);
  readonly avisos = computed(() => {
    const a = this.alertas();
    return a ? armarAlertas(a) : [];
  });

  readonly clp = formatearClp;
  readonly miles = (n: number) => formatearEntero(Math.round(n / 1000));

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const r = this.rangos();
    this.estado.set("cargando");
    try {
      const [mes, anterior, semanas, alertas] = await Promise.all([
        this.panel.ventas(r.mes.desde, r.mes.hasta),
        this.panel.ventas(r.mesAnterior.desde, r.mesAnterior.hasta),
        this.panel.ventas(r.semanas.desde, r.semanas.hasta),
        this.panel.alertas()
      ]);
      this.mes.set(mes);
      this.anterior.set(anterior);
      this.semanas.set(semanas);
      this.alertas.set(alertas);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }
}
