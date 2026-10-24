import { DatePipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subject, debounceTime, distinctUntilChanged } from "rxjs";
import { EstadoProveedor, ProveedorListadoItem } from "../../core/models/proveedores.models";
import { ProveedoresService } from "./proveedores.service";
import { ETIQUETA_ESTADO, formatearComision } from "./proveedores.util";

const TAMANO = 20;

@Component({
  selector: "app-proveedores-list",
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: "./proveedores-list.component.html",
  styleUrl: "./proveedores-list.component.css"
})
export class ProveedoresListComponent {
  private readonly svc = inject(ProveedoresService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busqueda$ = new Subject<string>();
  private solicitud = 0;

  readonly formatearComision = formatearComision;
  readonly etiquetas = ETIQUETA_ESTADO;
  readonly estados: EstadoProveedor[] = ["en_revision", "activa", "suspendida"];

  readonly items = signal<ProveedorListadoItem[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);
  readonly estado = signal("");
  readonly q = signal("");
  readonly pagina = signal(1);

  constructor() {
    this.busqueda$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navegar({ q: q.trim() || null, pagina: null }));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.estado.set(p.get("estado") ?? "");
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
      .listar({ estado: this.estado() as EstadoProveedor | "", q: this.q(), pagina: this.pagina(), tamano: TAMANO })
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
          this.error.set(e?.error?.error?.message ?? "No se pudo cargar el listado de proveedores.");
          this.cargando.set(false);
        }
      });
  }
}
