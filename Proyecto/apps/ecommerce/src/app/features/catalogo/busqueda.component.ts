import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AnaliticaService } from "../../core/analitica/analitica.service";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import { FiltrosCatalogo, PaginaCatalogo } from "../../core/models/catalogo.models";
import { formatearClp, plazo, precioPorUnidad } from "../../shared/formato";

export const POR_PAGINA_BUSQUEDA = 20;
const entero = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

// /buscar?q= (KAN-91): resultados para un termino con su conteo, refinables
// por entrega en 24 h, sin minimo de compra, distribuidor con retiro y marca.
// Cada producto dice cual es el distribuidor mas barato y cuanto pide el mas
// caro. Cada busqueda nueva se registra como evento "busqueda" con su
// cantidad de resultados (las de 0 alimentan el reporte de terminos sin resultados).
@Component({
  selector: "app-busqueda",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./busqueda.component.html",
  styleUrl: "./busqueda.component.css"
})
export class BusquedaComponent {
  private readonly catalogo = inject(CatalogoService);
  private readonly analitica = inject(AnaliticaService);
  private readonly router = inject(Router);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  readonly termino = computed(() => (this.query().get("q") ?? "").trim());
  readonly refinar = computed(() => {
    const q = this.query();
    return {
      solo24: q.get("plazo24") === "1",
      sinMinimo: q.get("sinMinimo") === "1",
      retiro: q.get("retiro") === "1",
      marca: q.get("marca") || null,
      pagina: entero(q.get("pagina")) ?? 1
    };
  });
  readonly hayRefinamiento = computed(() => {
    const r = this.refinar();
    return r.solo24 || r.sinMinimo || r.retiro || !!r.marca;
  });

  readonly resultado = signal<PaginaCatalogo | null>(null);
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil((this.resultado()?.total ?? 0) / POR_PAGINA_BUSQUEDA)));
  /** Sugerencias cuando no hay resultados: las categorias con mas productos. */
  readonly sugerencias = computed(() =>
    [...(this.catalogo.resumen()?.categorias ?? [])].filter((c) => c.productos > 0).sort((a, b) => b.productos - a.productos).slice(0, 4)
  );
  private ultimoRegistrado: string | null = null;

  readonly clp = formatearClp;
  readonly plazo = plazo;
  readonly porUnidad = precioPorUnidad;
  readonly nombreCategoria = (id: number) => this.catalogo.categoriasPorId().get(id)?.nombre ?? "";

  constructor() {
    void this.catalogo.cargarResumen();
    effect(() => {
      const termino = this.termino();
      const r = this.refinar();
      untracked(() => {
        if (!termino) {
          this.resultado.set(null);
          return;
        }
        void this.buscar({
          q: termino,
          plazoMaxHoras: r.solo24 ? 24 : undefined,
          maxMinimoCompra: r.sinMinimo ? 1 : undefined,
          conRetiro: r.retiro || undefined,
          marca: r.marca ?? undefined,
          orden: "relevancia",
          pagina: r.pagina,
          porPagina: POR_PAGINA_BUSQUEDA
        });
      });
    });
  }

  async buscar(f: FiltrosCatalogo): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      const r = await this.catalogo.listar(f);
      this.resultado.set(r);
      // Un evento por termino nuevo (no por refinar ni paginar).
      if (f.q && f.q.toLowerCase() !== this.ultimoRegistrado) {
        this.ultimoRegistrado = f.q.toLowerCase();
        this.analitica.busqueda(f.q, r.total);
      }
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  reintentar(): void {
    this.ultimoRegistrado = null;
    const t = this.termino();
    const r = this.refinar();
    void this.buscar({ q: t, plazoMaxHoras: r.solo24 ? 24 : undefined, maxMinimoCompra: r.sinMinimo ? 1 : undefined, conRetiro: r.retiro || undefined, marca: r.marca ?? undefined, pagina: r.pagina, porPagina: POR_PAGINA_BUSQUEDA });
  }

  /** Activa o desactiva un refinamiento; vuelve a la pagina 1. */
  alternar(param: "plazo24" | "sinMinimo" | "retiro", activo: boolean): void {
    void this.router.navigate([], { queryParams: { [param]: activo ? null : 1, pagina: null }, queryParamsHandling: "merge" });
  }

  elegirMarca(marca: string): void {
    void this.router.navigate([], { queryParams: { marca: marca || null, pagina: null }, queryParamsHandling: "merge" });
  }

  irAPagina(p: number): void {
    void this.router.navigate([], { queryParams: { pagina: p > 1 ? p : null }, queryParamsHandling: "merge" });
  }

  quitarRefinamientos(): void {
    void this.router.navigate([], { queryParams: { q: this.termino() } });
  }
}
