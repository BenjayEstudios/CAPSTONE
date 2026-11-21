import { DatePipe, NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, debounceTime } from "rxjs";
import { SessionState } from "../../core/state/session.state";
import {
  CrearUsuarioRespuesta, EstadoUsuario, MfaEstado, OpcionesUsuario, OrdenUsuarios, OrganizacionOpcion, UsuarioItem
} from "../../core/models/usuarios.models";
import { OrganizacionSelectorComponent } from "./organizacion-selector.component";
import { UsuariosService } from "./usuarios.service";
import {
  ETIQUETA_ESTADO, ETIQUETA_MFA, ETIQUETA_ORDEN, ORDENES, TAMANOS_PAGINA, TAMANO_POR_DEFECTO,
  leerOrden, leerPagina, leerTamano, mensajeErrorUsuario, resumenResultados, siguienteOrdenPorNombre, validarFormulario
} from "./usuarios.util";

@Component({
  selector: "app-usuarios",
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, OrganizacionSelectorComponent],
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
  readonly etiquetasOrden = ETIQUETA_ORDEN;
  readonly ordenes = ORDENES;
  readonly tamanos = TAMANOS_PAGINA;
  readonly estados: EstadoUsuario[] = ["invitado", "activo", "suspendido"];
  readonly mfaEstados: MfaEstado[] = ["inactivo", "opcional", "pendiente", "activo"];

  readonly puedeEscribir = computed(() => this.session.usuario()?.permisos?.["crear_usuario"] === "total");
  readonly miId = computed(() => Number(this.session.usuario()?.id));

  // Listado
  readonly items = signal<UsuarioItem[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalExacto = signal(true);
  readonly hayMas = signal(false);
  readonly estado = signal("");
  readonly rolId = signal("");
  readonly organizacionId = signal("");
  readonly orgEtiqueta = signal(""); // nombre de la organizacion filtrada (la URL solo trae el id)
  readonly q = signal("");
  readonly orden = signal<OrdenUsuarios>("reciente");
  readonly tamano = signal(TAMANO_POR_DEFECTO);
  readonly pagina = signal(1);
  readonly opciones = signal<OpcionesUsuario>({ roles: [] });

  readonly resumen = computed(() =>
    resumenResultados({ pagina: this.pagina(), tamano: this.tamano(), cantidad: this.items().length, total: this.total(), totalExacto: this.totalExacto() })
  );
  readonly hayFiltros = computed(() => !!(this.q() || this.rolId() || this.organizacionId() || this.estado()));
  readonly nombreRolFiltro = computed(() => this.opciones().roles.find((r) => String(r.id) === this.rolId())?.nombre ?? `Rol ${this.rolId()}`);
  readonly etiquetaEstadoFiltro = computed(() => ETIQUETA_ESTADO[this.estado() as EstadoUsuario] ?? this.estado());
  readonly iconoOrdenNombre = computed(() => (this.orden() === "nombre_asc" ? "▲" : this.orden() === "nombre_desc" ? "▼" : ""));
  readonly ariaOrdenNombre = computed(() =>
    this.orden() === "nombre_asc" ? "ascending" : this.orden() === "nombre_desc" ? "descending" : "none"
  );

  // Formulario crear / editar
  readonly panel = signal<"crear" | UsuarioItem | null>(null);
  readonly fNombre = signal("");
  readonly fEmail = signal("");
  readonly fRol = signal("");
  readonly fOrg = signal("");
  readonly fOrgEtiqueta = signal("");
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
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navegar({ q: q.trim() || null, pagina: null }));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.estado.set(p.get("estado") ?? "");
      this.rolId.set(p.get("rolId") ?? "");
      const org = p.get("organizacionId") ?? "";
      if (org !== this.organizacionId()) this.orgEtiqueta.set("");
      this.organizacionId.set(org);
      this.q.set(p.get("q") ?? "");
      this.orden.set(leerOrden(p.get("orden")));
      this.tamano.set(leerTamano(p.get("tamano")));
      this.pagina.set(leerPagina(p.get("pagina")));
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
  onOrganizacionFiltro(o: OrganizacionOpcion | null): void {
    this.orgEtiqueta.set(o?.razonSocial ?? "");
    this.navegar({ organizacionId: o ? String(o.id) : null, pagina: null });
  }
  onOrden(v: string): void {
    this.navegar({ orden: leerOrden(v) === "reciente" ? null : leerOrden(v), pagina: null });
  }
  ordenarPorNombre(): void {
    const sig = siguienteOrdenPorNombre(this.orden());
    this.navegar({ orden: sig === "reciente" ? null : sig, pagina: null });
  }
  onTamano(v: string): void {
    const n = leerTamano(v);
    this.navegar({ tamano: n === TAMANO_POR_DEFECTO ? null : n, pagina: null });
  }
  quitarFiltro(clave: "q" | "rolId" | "organizacionId" | "estado"): void {
    this.navegar({ [clave]: null, pagina: null });
  }
  limpiarFiltros(): void {
    this.navegar({ q: null, rolId: null, organizacionId: null, estado: null, pagina: null });
  }
  irAPagina(n: number): void {
    if (n < 1 || n === this.pagina() || (n > this.pagina() && !this.hayMas())) return;
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
    this.fOrgEtiqueta.set(u.organizacion.razonSocial);
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
  onOrganizacionForm(o: OrganizacionOpcion | null): void {
    this.fOrg.set(o ? String(o.id) : "");
    this.fOrgEtiqueta.set(o?.razonSocial ?? "");
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
    this.fOrgEtiqueta.set("");
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
        orden: this.orden(),
        pagina: this.pagina(),
        tamano: this.tamano()
      })
      .subscribe({
        next: (r) => {
          if (id !== this.solicitud) return;
          // Pagina fuera de rango (p. ej. se suspendio/filtro la ultima fila): vuelve a la primera.
          if (r.items.length === 0 && this.pagina() > 1) {
            this.navegar({ pagina: null });
            return;
          }
          this.items.set(r.items);
          this.total.set(r.total);
          this.totalExacto.set(r.totalExacto);
          this.hayMas.set(r.hayMas);
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
