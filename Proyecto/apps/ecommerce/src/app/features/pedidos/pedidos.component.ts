import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { OrdenDetalle } from "../../core/models/checkout.models";
import { PaginaOrdenes, PedidosService } from "../../core/pedidos/pedidos.service";
import { SessionState } from "../../core/state/session.state";
import { formatearClp } from "../../shared/formato";
import { estadoEnvio, estadoOrden, FILTROS_PEDIDOS, tonoOrden } from "./estados";

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });
const TAMANO = 10;

// /pedidos (KAN-98): historial de ordenes del comprador con folio, fecha,
// total y estado, y el estado de cada envio por distribuidor. Filtro por
// estado y paginas en la URL (?estado=&pagina=).
@Component({
  selector: "app-pedidos",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./pedidos.component.html",
  styleUrl: "./pedidos.component.css"
})
export class PedidosComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pedidos = inject(PedidosService);
  readonly session = inject(SessionState);
  private readonly query = toSignal(this.ruta.queryParamMap, { requireSync: true });

  readonly filtros = FILTROS_PEDIDOS;
  readonly estado = computed(() => {
    const e = this.query().get("estado");
    return FILTROS_PEDIDOS.some((f) => f.estado === e) ? e : null;
  });
  readonly pagina = computed(() => Math.max(1, Number(this.query().get("pagina")) || 1));
  readonly resultado = signal<PaginaOrdenes | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);

  readonly clp = formatearClp;
  readonly estadoOrden = estadoOrden;
  readonly tonoOrden = tonoOrden;
  readonly estadoEnvio = estadoEnvio;

  constructor() {
    effect(() => {
      const estado = this.estado();
      const pagina = this.pagina();
      untracked(() => void this.cargar(estado, pagina));
    });
  }

  async cargar(estado = this.estado(), pagina = this.pagina()): Promise<void> {
    if (!this.session.esComprador()) return this.cargando.set(false);
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.resultado.set(await this.pedidos.listar({ estado, pagina, tamano: TAMANO }));
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  filtrar(estado: string | null): void {
    void this.router.navigate([], { queryParams: { estado, pagina: null }, queryParamsHandling: "merge" });
  }

  irAPagina(pagina: number): void {
    void this.router.navigate([], { queryParams: { pagina: pagina > 1 ? pagina : null }, queryParamsHandling: "merge" });
  }

  fecha(o: OrdenDetalle): string {
    return fecha.format(new Date(o.pagadoEn ?? o.creadaEn));
  }

  distribuidores(o: OrdenDetalle): string {
    return `${o.envios.length} ${o.envios.length === 1 ? "distribuidor" : "distribuidores"}`;
  }
}
