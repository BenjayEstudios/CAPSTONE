import { DatePipe } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Caso, CasoDetalle, EstadoCaso, TipoCaso, UsuarioInterno } from "../../core/models/moderacion.models";
import { SessionState } from "../../core/state/session.state";
import { ModeracionService } from "./moderacion.service";
import {
  ETIQUETA_ESTADO, ETIQUETA_OPERACION, ETIQUETA_TIPO, MAX_TEXTO, accionesCaso, asignadoParaApi,
  mensajeErrorModeracion, rutaEntidad, validarTexto
} from "./moderacion.util";

const TAMANO = 20;
type Modo = "asignar" | "resolver" | "descartar" | null;

@Component({
  selector: "app-moderacion-cola",
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: "./moderacion-cola.component.html",
  styleUrl: "./moderacion-cola.component.css"
})
export class ModeracionColaComponent {
  private readonly svc = inject(ModeracionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sesion = inject(SessionState);
  private solicitud = 0;
  private solicitudDetalle = 0;

  readonly tipos = Object.keys(ETIQUETA_TIPO) as TipoCaso[];
  readonly estados = Object.keys(ETIQUETA_ESTADO) as EstadoCaso[];
  readonly etiquetaTipo = ETIQUETA_TIPO;
  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly etiquetaOperacion = ETIQUETA_OPERACION;
  readonly maxTexto = MAX_TEXTO;
  readonly rutaEntidad = rutaEntidad;

  readonly items = signal<Caso[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);
  readonly pagina = signal(1);
  readonly tipo = signal("");
  /** "" = todos los estados; por defecto la cola muestra los abiertos. */
  readonly estado = signal("abierto");
  readonly asignado = signal("");
  readonly seleccionadoId = signal<number | null>(null);

  readonly detalle = signal<CasoDetalle | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly errorDetalle = signal<string | null>(null);
  readonly acciones = computed(() => {
    const d = this.detalle();
    return d ? accionesCaso(d.estado) : null;
  });

  readonly internos = signal<UsuarioInterno[]>([]);
  readonly modo = signal<Modo>(null);
  readonly destino = signal("");
  readonly texto = signal("");
  readonly confirmando = signal(false);
  readonly errorTexto = signal<string | null>(null);
  readonly enCurso = signal(false);
  readonly errorAccion = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.tipo.set(p.get("tipo") ?? "");
      const e = p.get("estado");
      this.estado.set(e === null ? "abierto" : e === "todos" ? "" : e);
      this.asignado.set(p.get("asignado") ?? "");
      this.pagina.set(Math.max(1, Number(p.get("pagina")) || 1));
      const sel = Number(p.get("caso")) || null;
      const cambioSel = sel !== this.seleccionadoId();
      this.seleccionadoId.set(sel);
      this.cargar();
      if (cambioSel) this.cargarDetalle();
    });
    this.svc.usuariosInternos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.internos.set(r.items),
      error: () => this.internos.set([])
    });
  }

  onTipo(v: string): void {
    this.navegar({ tipo: v || null, pagina: null });
  }
  onEstado(v: string): void {
    this.navegar({ estado: v === "" ? "todos" : v === "abierto" ? null : v, pagina: null });
  }
  onAsignado(v: string): void {
    this.navegar({ asignado: v || null, pagina: null });
  }
  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas() || n === this.pagina()) return;
    this.navegar({ pagina: n === 1 ? null : n });
  }
  seleccionar(id: number): void {
    this.navegar({ caso: id });
  }
  cerrarDetalle(): void {
    this.navegar({ caso: null });
  }
  reintentar(): void {
    this.cargar();
  }
  reintentarDetalle(): void {
    this.cargarDetalle();
  }

  // --- acciones del panel ---
  abrirModo(m: Modo): void {
    this.modo.set(m);
    this.texto.set("");
    this.destino.set("");
    this.confirmando.set(false);
    this.errorTexto.set(null);
    this.errorAccion.set(null);
  }
  cancelar(): void {
    this.abrirModo(null);
  }
  asignarme(): void {
    const id = Number(this.sesion.usuario()?.id);
    if (id) this.ejecutarAsignar(id);
  }
  desasignar(): void {
    this.ejecutarAsignar(null);
  }
  aplicarAsignacion(): void {
    const id = Number(this.destino());
    if (!id) {
      this.errorTexto.set("Elige un usuario.");
      return;
    }
    this.ejecutarAsignar(id);
  }
  /** Paso 1: valida el texto y pide confirmacion. */
  revisar(): void {
    const e = validarTexto(this.texto());
    this.errorTexto.set(e);
    if (!e) this.confirmando.set(true);
  }
  volverAEditar(): void {
    this.confirmando.set(false);
  }
  /** Paso 2: ejecuta. */
  confirmar(): void {
    const d = this.detalle();
    const m = this.modo();
    if (!d || (m !== "resolver" && m !== "descartar")) return;
    const obs = m === "resolver" ? this.svc.resolver(d.id, this.texto()) : this.svc.descartar(d.id, this.texto());
    this.correr(obs, m === "resolver" ? "Caso resuelto." : "Caso descartado.");
  }

  private ejecutarAsignar(usuarioId: number | null): void {
    const d = this.detalle();
    if (!d) return;
    this.correr(this.svc.asignar(d.id, usuarioId), usuarioId === null ? "Asignación quitada." : "Caso asignado.");
  }

  private correr(obs: ReturnType<ModeracionService["asignar"]>, aviso: string): void {
    this.enCurso.set(true);
    this.errorAccion.set(null);
    obs.subscribe({
      next: () => {
        this.enCurso.set(false);
        this.abrirModo(null);
        this.aviso.set(aviso);
        this.cargarDetalle();
        this.cargar();
      },
      error: (e) => {
        this.enCurso.set(false);
        this.confirmando.set(false);
        this.errorAccion.set(mensajeErrorModeracion(e));
      }
    });
  }

  private navegar(params: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: "merge" });
  }

  private cargar(): void {
    const id = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(null);
    const miId = this.sesion.usuario()?.id;
    this.svc
      .listar({
        tipo: this.tipo() as TipoCaso | "",
        estado: this.estado() as EstadoCaso | "",
        asignadoA: asignadoParaApi(this.asignado(), miId),
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
          this.error.set(e?.error?.error?.message ?? "No se pudo cargar la cola de moderación.");
          this.cargando.set(false);
        }
      });
  }

  private cargarDetalle(): void {
    const sel = this.seleccionadoId();
    const id = ++this.solicitudDetalle;
    this.abrirModo(null);
    if (sel === null) {
      this.detalle.set(null);
      this.errorDetalle.set(null);
      return;
    }
    this.cargandoDetalle.set(true);
    this.errorDetalle.set(null);
    this.svc.obtener(sel).subscribe({
      next: (d) => {
        if (id !== this.solicitudDetalle) return;
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
      },
      error: (e) => {
        if (id !== this.solicitudDetalle) return;
        this.detalle.set(null);
        this.errorDetalle.set(mensajeErrorModeracion(e));
        this.cargandoDetalle.set(false);
      }
    });
  }
}
