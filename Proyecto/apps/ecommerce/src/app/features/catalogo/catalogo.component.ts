import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import { FiltrosCatalogo, OrdenCatalogo, PaginaCatalogo } from "../../core/models/catalogo.models";
import { formatearClp, plazo, precioPorUnidad } from "../../shared/formato";

export const POR_PAGINA = 24;
export type Vista = "tarjetas" | "lista";
const VISTA_KEY = "cotizapp.catalogo.vista";

function vistaGuardada(): Vista {
  try {
    return localStorage.getItem(VISTA_KEY) === "lista" ? "lista" : "tarjetas";
  } catch {
    return "tarjetas";
  }
}

const entero = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

// /catalogo (KAN-90): listado filtrable por categoria, plazo y minimo de
// compra, ordenado por el precio mas bajo publicado, en tarjetas o en tabla
// (las variantes "Tarjetas" y "Lista densa" del mockup). Los filtros viven en
// la URL: se pueden compartir y el boton atras funciona.
@Component({
  selector: "app-catalogo",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./catalogo.component.html",
  styleUrl: "./catalogo.component.css"
})
export class CatalogoComponent {
  private readonly catalogo = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });

  readonly categorias = computed(() => (this.catalogo.resumen()?.categorias ?? []).filter((c) => c.productos > 0));
  readonly filtros = computed(() => {
    const q = this.query();
    const orden = q.get("orden");
    return {
      categoriaId: entero(q.get("categoria")),
      plazoMaxHoras: entero(q.get("plazo")),
      maxMinimoCompra: entero(q.get("minimo")),
      orden: (["precio", "nombre", "diferencia"].includes(orden ?? "") ? orden : "precio") as OrdenCatalogo,
      pagina: entero(q.get("pagina")) ?? 1
    };
  });
  readonly categoriaActual = computed(() => {
    const id = this.filtros().categoriaId;
    return id ? this.catalogo.categoriasPorId().get(id) ?? null : null;
  });
  readonly titulo = computed(() => this.categoriaActual()?.nombre ?? "Todo el catálogo");
  readonly hayFiltros = computed(() => {
    const f = this.filtros();
    return f.categoriaId !== undefined || f.plazoMaxHoras !== undefined || f.maxMinimoCompra !== undefined;
  });

  readonly pagina = signal<PaginaCatalogo | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly vista = signal<Vista>(vistaGuardada());
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil((this.pagina()?.total ?? 0) / POR_PAGINA)));

  readonly clp = formatearClp;
  readonly plazo = plazo;
  readonly porUnidad = precioPorUnidad;
  readonly nombreCategoria = (id: number) => this.catalogo.categoriasPorId().get(id)?.nombre ?? "";

  constructor() {
    void this.catalogo.cargarResumen();
    // Cada cambio de filtros en la URL vuelve a pedir el listado.
    effect(() => {
      const f = this.filtros();
      untracked(() => void this.cargar(f));
    });
  }

  async cargar(f: FiltrosCatalogo = this.filtros()): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.pagina.set(await this.catalogo.listar({ ...f, porPagina: POR_PAGINA }));
    } catch {
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Cambia filtros en la URL; cualquier cambio de filtro vuelve a la pagina 1. */
  filtrar(cambios: Record<string, string | number | null>): void {
    const reiniciaPagina = !("pagina" in cambios);
    void this.router.navigate([], {
      queryParams: { ...cambios, ...(reiniciaPagina ? { pagina: null } : {}) },
      queryParamsHandling: "merge"
    });
  }

  limpiar(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  cambiarVista(v: Vista): void {
    this.vista.set(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      // La preferencia solo se pierde al recargar.
    }
  }
}
