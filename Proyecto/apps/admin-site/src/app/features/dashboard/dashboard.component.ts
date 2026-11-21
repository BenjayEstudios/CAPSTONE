import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { EstadisticasPlataforma, KpiDashboard, ResumenDashboard } from "../../core/models/dashboard.models";
import { SessionState } from "../../core/state/session.state";
import { DashboardService } from "./dashboard.service";
import {
  ETIQUETA_PROBLEMA, claseVariacion, etiquetaDia, etiquetaMes, etiquetaSemana, formatoClp, formatoConversion, geometriaDias,
  geometriaGrafico, mensajeErrorDashboard, mensajeErrorTrafico, mesLocalActual, rangoDelMes, textoVariacion
} from "./dashboard.util";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css"
})
export class DashboardComponent {
  private readonly svc = inject(DashboardService);
  private readonly session = inject(SessionState);
  private readonly destroyRef = inject(DestroyRef);
  private solicitud = 0;
  private solicitudTrafico = 0;

  readonly conversion = formatoConversion;
  readonly dia = etiquetaDia;
  readonly clp = formatoClp;
  readonly variacion = textoVariacion;
  readonly claseVar = claseVariacion;
  readonly etiquetaProblema = ETIQUETA_PROBLEMA;
  readonly etiquetaSemana = etiquetaSemana;
  readonly etiquetaMes = etiquetaMes;
  readonly mesMax = mesLocalActual();

  readonly puedeVer = computed(() => this.session.tienePermiso("ver_todas_ordenes"));
  readonly nombre = computed(() => this.session.usuario()?.nombre ?? "");
  readonly resumen = signal<ResumenDashboard | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mes = signal<string | undefined>(undefined);

  // Trafico y demanda (KAN-154): se carga aparte; un fallo aqui no tumba el resto del dashboard.
  readonly trafico = signal<EstadisticasPlataforma | null>(null);
  readonly cargandoTrafico = signal(false);
  readonly errorTrafico = signal<string | null>(null);
  readonly graficoTrafico = computed(() =>
    geometriaDias((this.trafico()?.porDia ?? []).map((d) => ({ fecha: d.fecha, valor: d.vistas })))
  );
  readonly sinTrafico = computed(() => {
    const t = this.trafico()?.totales;
    return !!t && t.vistas === 0 && t.clicks === 0 && t.busquedas === 0;
  });
  readonly maxVistasProducto = computed(() => Math.max(1, ...(this.trafico()?.productosMasVistos ?? []).map((p) => p.vistas)));
  readonly maxBusquedasTermino = computed(() => Math.max(1, ...(this.trafico()?.terminosMasBuscados ?? []).map((t) => t.busquedas)));

  readonly grafico = computed(() => geometriaGrafico(this.resumen()?.semanas ?? []));
  readonly sinActividad = computed(() => {
    const r = this.resumen();
    return !!r && r.kpis.ordenes.valor === 0 && r.semanas.every((s) => s.monto === 0);
  });
  readonly tarjetas = computed(() => {
    const k = this.resumen()?.kpis;
    if (!k) return [];
    const t = (id: string, titulo: string, kpi: KpiDashboard, moneda: boolean) => ({ id, titulo, kpi, moneda });
    return [
      t("ordenes", "Órdenes del mes", k.ordenes, false),
      t("monto", "Monto transado", k.montoTransado, true),
      t("comision", "Comisión", k.comision, true),
      t("proveedores", "Proveedores activos", k.proveedoresActivos, false)
    ];
  });
  readonly totalSalud = computed(() => {
    const s = this.resumen()?.saludCatalogo;
    return s ? s.sinImagen + s.sinOfertas + s.duplicadas : 0;
  });

  constructor() {
    if (this.puedeVer()) this.cargar();
  }

  cargar() {
    const id = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(null);
    this.svc.resumen(this.mes()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        if (id !== this.solicitud) return;
        this.resumen.set(r);
        this.cargando.set(false);
        this.cargarTrafico(r.mes);
      },
      error: (e) => {
        if (id !== this.solicitud) return;
        this.error.set(mensajeErrorDashboard(e));
        this.cargando.set(false);
      }
    });
  }

  cargarTrafico(mes: string = this.resumen()?.mes ?? this.mes() ?? mesLocalActual()) {
    const id = ++this.solicitudTrafico;
    const { desde, hasta } = rangoDelMes(mes);
    this.cargandoTrafico.set(true);
    this.errorTrafico.set(null);
    this.svc.trafico(desde, hasta).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (t) => {
        if (id !== this.solicitudTrafico) return;
        this.trafico.set(t);
        this.cargandoTrafico.set(false);
      },
      error: (e) => {
        if (id !== this.solicitudTrafico) return;
        this.trafico.set(null);
        this.errorTrafico.set(mensajeErrorTrafico(e));
        this.cargandoTrafico.set(false);
      }
    });
  }

  onMes(valor: string) {
    if (!/^\d{4}-\d{2}$/.test(valor)) return;
    this.mes.set(valor);
    this.cargar();
  }

  valorKpi(t: { kpi: KpiDashboard; moneda: boolean }): string {
    return t.moneda ? formatoClp(t.kpi.valor) : t.kpi.valor.toLocaleString("es-CL");
  }
}
