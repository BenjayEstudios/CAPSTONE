import { Component, computed, inject, signal } from "@angular/core";
import { DemandaProveedor, PanelProveedorService } from "../../core/proveedor/panel-proveedor.service";
import { formatearEntero } from "../../shared/formato";
import { RELOJ } from "../../core/reloj";

const DIA_MS = 86_400_000;
const CORTA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });

/** Primer dia (yyyy-mm-dd, UTC) de una ventana de `dias` que termina hoy. */
export function desdeHace(dias: number, hoy: Date): string {
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - (dias - 1) * DIA_MS).toISOString().slice(0, 10);
}

/** 27.7 -> "27,7 %"; null -> "—". */
export function textoPorcentaje(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString("es-CL", { maximumFractionDigits: 1 })} %`;
}

/** Ancho de una barra (0-100 %), relativo a `maximo`. */
export function anchoBarra(valor: number, maximo: number): string {
  return `${maximo > 0 ? Math.min(100, Math.round((valor / maximo) * 100)) : 0}%`;
}

// /proveedor/demanda (KAN-107): que miran los clientes, donde estan y cuanto
// stock queda. Tres bloques como en el mockup: mas vistos y clickeados (con
// conversion y cajas vendidas), productos restantes (stock sobre el del
// inicio del mes) y clientes potenciales por comuna (vieron y le compraron a
// otro proveedor), marcando si el proveedor despacha ahi. Ultimos 30 dias,
// con la opcion de mirar 90.
@Component({
  selector: "app-demanda-proveedor",
  standalone: true,
  templateUrl: "./demanda.component.html",
  styleUrl: "./demanda.component.css"
})
export class DemandaProveedorComponent {
  private readonly panel = inject(PanelProveedorService);
  private readonly hoy = inject(RELOJ);

  readonly ventanas = [30, 90];
  readonly dias = signal(30);
  readonly datos = signal<DemandaProveedor | null>(null);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");

  readonly entero = formatearEntero;
  readonly porcentaje = textoPorcentaje;
  readonly ancho = anchoBarra;
  readonly corta = (iso: string) => CORTA.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

  readonly maxPotenciales = computed(() => Math.max(0, ...(this.datos()?.potenciales.map((p) => p.clientes) ?? [])));
  readonly sinActividad = computed(() => {
    const d = this.datos();
    return !!d && d.productos.every((p) => p.vistas === 0 && p.clicks === 0 && p.cajasVendidas === 0);
  });

  constructor() {
    void this.cargar();
  }

  elegir(dias: number): void {
    if (this.dias() === dias) return;
    this.dias.set(dias);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      this.datos.set(await this.panel.demanda(desdeHace(this.dias(), this.hoy())));
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }
}
