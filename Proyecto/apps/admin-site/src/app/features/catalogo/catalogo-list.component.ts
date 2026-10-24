import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subject, debounceTime, distinctUntilChanged } from "rxjs";
import { EstadoProducto, ProductoListadoItem } from "../../core/models/catalogo.models";
import { CatalogoService, etiquetasCategorias, formatearPrecio } from "./catalogo.service";

const TAMANO = 20;

@Component({
  selector: "app-catalogo-list",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./catalogo-list.component.html",
  styleUrl: "./catalogo-list.component.css"
})
export class CatalogoListComponent {
  private readonly svc = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busqueda$ = new Subject<string>();
  private solicitud = 0;

  readonly formatearPrecio = formatearPrecio;
  readonly estados: EstadoProducto[] = ["borrador", "publicado", "archivado"];

  readonly items = signal<ProductoListadoItem[]>([]);
  readonly categorias = signal<{ id: string; etiqueta: string }[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);

  // Estado de filtros: fuente de verdad = query params de la URL.
  readonly estado = signal("");
  readonly categoriaId = signal("");
  readonly q = signal("");
  readonly pagina = signal(1);

  constructor() {
    this.svc.categorias().subscribe({
      next: (c) => this.categorias.set(etiquetasCategorias(c)),
      error: () => this.categorias.set([])
    });

    this.busqueda$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navegar({ q: q.trim() || null, pagina: null }));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.estado.set(p.get("estado") ?? "");
      this.categoriaId.set(p.get("categoriaId") ?? "");
      this.q.set(p.get("q") ?? "");
      this.pagina.set(Math.max(1, Number(p.get("pagina")) || 1));
      this.cargar();
    });
  }

  onBusqueda(valor: string): void {
    this.q.set(valor);
    this.busqueda$.next(valor);
  }

  onEstado(valor: string): void {
    this.navegar({ estado: valor || null, pagina: null });
  }

  onCategoria(valor: string): void {
    this.navegar({ categoriaId: valor || null, pagina: null });
  }

  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas() || n === this.pagina()) return;
    this.navegar({ pagina: n === 1 ? null : n });
  }

  reintentar(): void {
    this.cargar();
  }

  private navegar(params: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: "merge" });
  }

  private cargar(): void {
    const id = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(null);
    this.svc
      .listar({
        estado: this.estado() as EstadoProducto | "",
        categoriaId: this.categoriaId(),
        q: this.q(),
        pagina: this.pagina(),
        tamano: TAMANO
      })
      .subscribe({
        next: (r) => {
          if (id !== this.solicitud) return;
          this.items.set(r.items);
          this.total.set(r.total);
          this.totalPaginas.set(r.totalPaginas);
          this.cargando.set(false);
        },
        error: (e) => {
          if (id !== this.solicitud) return;
          this.items.set([]);
          this.error.set(e?.error?.error?.message ?? "No se pudo cargar el catálogo.");
          this.cargando.set(false);
        }
      });
  }
}
