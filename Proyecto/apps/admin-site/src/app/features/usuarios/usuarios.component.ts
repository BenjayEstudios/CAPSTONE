import { DatePipe, NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, debounceTime, distinctUntilChanged } from "rxjs";
import { SessionState } from "../../core/state/session.state";
import {
  CrearUsuarioRespuesta, EstadoUsuario, MfaEstado, OpcionesUsuario, UsuarioItem
} from "../../core/models/usuarios.models";
import { UsuariosService } from "./usuarios.service";
import { ETIQUETA_ESTADO, ETIQUETA_MFA, mensajeErrorUsuario, validarFormulario } from "./usuarios.util";

const TAMANO = 20;

@Component({
  selector: "app-usuarios",
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet],
  templateUrl: "./usuarios.component.html",
  styleUrl: "./usuarios.component.css"
})
export class UsuariosComponent {
  private readonly svc = inject(UsuariosService);
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busqueda$ = new Subject<string>();
  private solicitud = 0;

  readonly etiquetasEstado = ETIQUETA_ESTADO;
  readonly etiquetasMfa = ETIQUETA_MFA;
  readonly estados: EstadoUsuario[] = ["invitado", "activo", "suspendido"];
  readonly mfaEstados: MfaEstado[] = ["inactivo", "opcional", "pendiente", "activo"];

  readonly puedeEscribir = computed(() => this.session.usuario()?.permisos?.["crear_usuario"] === "total");
  readonly miId = computed(() => Number(this.session.usuario()?.id));

  // Listado
  readonly items = signal<UsuarioItem[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);
  readonly estado = signal("");
  readonly rolId = signal("");
  readonly organizacionId = signal("");
  readonly q = signal("");
  readonly pagina = signal(1);
  readonly opciones = signal<OpcionesUsuario>({ roles: [], organizaciones: [] });

  // Formulario crear / editar
  readonly panel = signal<"crear" | UsuarioItem | null>(null);
  readonly fNombre = signal("");
  readonly fEmail = signal("");
  readonly fRol = signal("");
  readonly fOrg = signal("");
  readonly fRut = signal("");
  readonly fTelefono = signal("");
  readonly fModo = signal<"invitacion" | "clave_temporal">("invitacion");
  readonly fMfa = signal("");
  readonly guardando = signal(false);
  readonly errorForm = signal<string | null>(null);

  // Resultado de la creacion (la clave temporal solo vive aqui hasta cerrar el aviso)
  readonly resultado = signal<CrearUsuarioRespuesta | null>(null);
  readonly copiado = signal(false);

  // Suspender / reactivar con confirmacion en dos pasos
  readonly confirmacion = signal<{ id: number; accion: "suspender" | "reactivar" } | null>(null);
  readonly procesandoId = signal<number | null>(null);
  readonly errorAccion = signal<string | null>(null);

  constructor() {
    this.svc.opciones().subscribe({ next: (o) => this.opciones.set(o), error: () => undefined });

    this.busqueda$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navegar({ q: q.trim() || null, pagina: null }));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.estado.set(p.get("estado") ?? "");
      this.rolId.set(p.get("rolId") ?? "");
      this.organizacionId.set(p.get("organizacionId") ?? "");
      this.q.set(p.get("q") ?? "");
      this.pagina.set(Math.max(1, Number(p.get("pagina")) || 1));
      this.cargar();
    });
  }

  onBusqueda(v: string): void {
    this.q.set(v);
    this.busqueda$.next(v);
  }
  onFiltro(clave: "estado" | "rolId" | "organizacionId", v: string): void {
    this.navegar({ [clave]: v || null, pagina: null });
  }
  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas() || n === this.pagina()) return;
    this.navegar({ pagina: n === 1 ? null : n });
  }
  reintentar(): void {
    this.cargar();
  }

  // --- crear / editar ---
  abrirCrear(): void {
    this.limpiarForm();
    this.resultado.set(null);
    this.panel.set("crear");
  }
  abrirEditar(u: UsuarioItem): void {
    this.limpiarForm();
    this.fNombre.set(u.nombre);
    this.fEmail.set(u.email);
    this.fRol.set(String(u.rol.id));
    this.fOrg.set(String(u.organizacion.id));
    this.fTelefono.set(u.telefono ?? "");
    this.fMfa.set(u.mfaEstado);
    this.panel.set(u);
  }
  cerrarPanel(): void {
    this.panel.set(null);
  }
  esPropio(u: UsuarioItem): boolean {
    return u.id === this.miId();
  }

  guardar(): void {
    const p = this.panel();
    if (!p || this.guardando()) return;
    const v = { nombre: this.fNombre(), email: this.fEmail(), rolId: this.fRol(), organizacionId: this.fOrg() };
    const invalido = validarFormulario(v, p === "crear");
    if (invalido) {
      this.errorForm.set(invalido);
      return;
    }
    this.guardando.set(true);
    this.errorForm.set(null);

    if (p === "crear") {
      this.svc
        .crear({
          nombre: v.nombre.trim(),
          email: v.email.trim(),
          rolId: Number(v.rolId),
          organizacionId: Number(v.organizacionId),
          ...(this.fRut().trim() ? { rut: this.fRut().trim() } : {}),
          ...(this.fTelefono().trim() ? { telefono: this.fTelefono().trim() } : {}),
          modo: this.fModo(),
          ...(this.fMfa() ? { mfa: this.fMfa() as "opcional" | "activo" } : {})
        })
        .subscribe({
          next: (r) => {
            this.guardando.set(false);
            this.panel.set(null);
            this.copiado.set(false);
            this.resultado.set(r);
            this.cargar();
          },
          error: (e) => {
            this.guardando.set(false);
            this.errorForm.set(mensajeErrorUsuario(e, "No se pudo crear el usuario."));
          }
        });
      return;
    }

    const propio = this.esPropio(p);
    this.svc
      .actualizar(p.id, {
        nombre: v.nombre.trim(),
        telefono: this.fTelefono().trim() || null,
        mfaEstado: this.fMfa() as MfaEstado,
        ...(propio ? {} : { rolId: Number(v.rolId), organizacionId: Number(v.organizacionId) })
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.panel.set(null);
          this.cargar();
        },
        error: (e) => {
          this.guardando.set(false);
          this.errorForm.set(mensajeErrorUsuario(e, "No se pudo guardar el usuario."));
        }
      });
  }

  async copiarClave(): Promise<void> {
    const clave = this.resultado()?.claveTemporal;
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
      this.copiado.set(true);
    } catch {
      this.errorAccion.set("No se pudo copiar automáticamente: selecciona la clave y cópiala a mano.");
    }
  }
  cerrarResultado(): void {
    this.resultado.set(null);
    this.copiado.set(false);
  }

  // --- suspender / reactivar ---
  pedirConfirmacion(u: UsuarioItem, accion: "suspender" | "reactivar"): void {
    this.errorAccion.set(null);
    this.confirmacion.set({ id: u.id, accion });
  }
  cancelarConfirmacion(): void {
    this.confirmacion.set(null);
  }
  confirmar(u: UsuarioItem): void {
    const c = this.confirmacion();
    if (!c || c.id !== u.id || this.procesandoId() !== null) return;
    this.procesandoId.set(u.id);
    const req = c.accion === "suspender" ? this.svc.suspender(u.id) : this.svc.reactivar(u.id);
    req.subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.confirmacion.set(null);
        this.cargar();
      },
      error: (e) => {
        this.procesandoId.set(null);
        this.confirmacion.set(null);
        this.errorAccion.set(mensajeErrorUsuario(e, "No se pudo completar la acción."));
      }
    });
  }

  private limpiarForm(): void {
    this.fNombre.set("");
    this.fEmail.set("");
    this.fRol.set("");
    this.fOrg.set("");
    this.fRut.set("");
    this.fTelefono.set("");
    this.fModo.set("invitacion");
    this.fMfa.set("");
    this.errorForm.set(null);
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
        estado: this.estado() as EstadoUsuario | "",
        rolId: this.rolId(),
        organizacionId: this.organizacionId(),
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
          this.error.set(mensajeErrorUsuario(e, "No se pudo cargar el listado de usuarios."));
          this.cargando.set(false);
        }
      });
  }
}
