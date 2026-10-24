import { DatePipe } from "@angular/common";
import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  FiltrosAuditoriaOpciones, RegistroAuditoriaDetalle, RegistroAuditoriaItem
} from "../../core/models/auditoria.models";
import { AuditoriaService } from "./auditoria.service";
import { calcularDiff, ETIQUETA_ACCION, formatearValor } from "./auditoria.util";

const TAMANO = 20;

@Component({
  selector: "app-auditoria-list",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./auditoria-list.component.html",
  styleUrl: "./auditoria-list.component.css"
})
export class AuditoriaListComponent {
  private readonly svc = inject(AuditoriaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private solicitud = 0;
  private solicitudDetalle = 0;

  readonly etiquetas = ETIQUETA_ACCION;
  readonly formatearValor = formatearValor;

  readonly opciones = signal<FiltrosAuditoriaOpciones>({ acciones: [], entidades: [], usuarios: [] });
  readonly items = signal<RegistroAuditoriaItem[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);
  readonly pagina = signal(1);
  readonly entidad = signal("");
  readonly accion = signal("");
  readonly usuarioId = signal("");
  readonly desde = signal("");
  readonly hasta = signal("");

  readonly seleccionadoId = signal<number | null>(null);
  readonly detalle = signal<RegistroAuditoriaDetalle | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly errorDetalle = signal<string | null>(null);
  readonly verCrudo = signal(false);
  readonly diff = computed(() => {
    const d = this.detalle();
    return d ? calcularDiff(d.datosAntes, d.datosDespues) : [];
  });
  readonly crudoAntes = computed(() => JSON.stringify(this.detalle()?.datosAntes ?? null, null, 2));
  readonly crudoDespues = computed(() => JSON.stringify(this.detalle()?.datosDespues ?? null, null, 2));

  constructor() {
    this.svc
      .filtros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (o) => this.opciones.set(o), error: () => undefined });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.entidad.set(p.get("entidad") ?? "");
      this.accion.set(p.get("accion") ?? "");
      this.usuarioId.set(p.get("usuarioId") ?? "");
      this.desde.set(p.get("desde") ?? "");
      this.hasta.set(p.get("hasta") ?? "");
      this.pagina.set(Math.max(1, Number(p.get("pagina")) || 1));
      this.cargar();
    });
  }

  onFiltro(clave: "entidad" | "accion" | "usuarioId" | "desde" | "hasta", valor: string): void {
    this.navegar({ [clave]: valor || null, pagina: null });
  }

  limpiar(): void {
    this.navegar({ entidad: null, accion: null, usuarioId: null, desde: null, hasta: null, pagina: null });
  }

  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas() || n === this.pagina()) return;
    this.navegar({ pagina: n === 1 ? null : n });
  }

  reintentar(): void {
    this.cargar();
  }

  abrir(item: RegistroAuditoriaItem): void {
    this.seleccionadoId.set(item.id);
    this.verCrudo.set(false);
    this.cargarDetalle(item.id);
  }

  cerrar(): void {
    this.solicitudDetalle++;
    this.seleccionadoId.set(null);
    this.detalle.set(null);
  }

  reintentarDetalle(): void {
    const id = this.seleccionadoId();
    if (id !== null) this.cargarDetalle(id);
  }

  private navegar(params: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: "merge" });
  }

  private cargarDetalle(id: number): void {
    const n = ++this.solicitudDetalle;
    this.cargandoDetalle.set(true);
    this.errorDetalle.set(null);
    this.detalle.set(null);
    this.svc.obtener(id).subscribe({
      next: (d) => {
        if (n !== this.solicitudDetalle) return;
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
      },
      error: (e) => {
        if (n !== this.solicitudDetalle) return;
        this.errorDetalle.set(e?.error?.error?.message ?? "No se pudo cargar el detalle del registro.");
        this.cargandoDetalle.set(false);
      }
    });
  }

  private cargar(): void {
    const id = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(null);
    this.svc
      .listar({
        entidad: this.entidad(), accion: this.accion(), usuarioId: this.usuarioId(),
        desde: this.desde(), hasta: this.hasta(), pagina: this.pagina(), tamano: TAMANO
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
          this.error.set(e?.error?.error?.message ?? "No se pudo cargar el registro de auditoría.");
          this.cargando.set(false);
        }
      });
  }
}
