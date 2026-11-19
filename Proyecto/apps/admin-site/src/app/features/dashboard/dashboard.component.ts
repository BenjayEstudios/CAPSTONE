import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { KpiDashboard, ResumenDashboard } from "../../core/models/dashboard.models";
import { SessionState } from "../../core/state/session.state";
import { DashboardService } from "./dashboard.service";
import {
  ETIQUETA_PROBLEMA, claseVariacion, etiquetaMes, etiquetaSemana, formatoClp, geometriaGrafico, mensajeErrorDashboard,
  mesLocalActual, textoVariacion
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
      },
      error: (e) => {
        if (id !== this.solicitud) return;
        this.error.set(mensajeErrorDashboard(e));
        this.cargando.set(false);
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
