import { DatePipe } from "@angular/common";
import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { NivelPermiso } from "../../core/models/auth.models";
import { PermisoCatalogo, RolMatriz } from "../../core/models/roles.models";
import { SessionState } from "../../core/state/session.state";
import { RolesService } from "./roles.service";
import {
  aplicarCambio, Cambios, celdaBloqueada, estaModificada, ETIQUETA_NIVEL, mensajeErrorRoles, NIVELES, nivelActual,
  permisosAEnviar, rolesModificados, totalCambios
} from "./roles.util";

@Component({
  selector: "app-roles",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./roles.component.html",
  styleUrl: "./roles.component.css"
})
export class RolesComponent implements OnInit {
  private readonly svc = inject(RolesService);
  private readonly session = inject(SessionState);

  readonly niveles = NIVELES;
  readonly etiquetaNivel = ETIQUETA_NIVEL;
  readonly celdaBloqueada = celdaBloqueada;

  readonly roles = signal<RolMatriz[]>([]);
  readonly catalogo = signal<PermisoCatalogo[]>([]);
  readonly cambios = signal<Cambios>({});
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly confirmando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorGuardado = signal<string | null>(null);
  readonly guardadoOk = signal(false);

  readonly pendientes = computed(() => totalCambios(this.cambios()));
  readonly rolesAfectados = computed(() => rolesModificados(this.roles(), this.cambios()));
  readonly ultimaActualizacion = computed(() => {
    const conFecha = this.roles().filter((r) => r.permisosActualizadoEn);
    if (conFecha.length === 0) return null;
    return conFecha.reduce((a, b) => (a.permisosActualizadoEn! >= b.permisosActualizadoEn! ? a : b));
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.svc.listar().subscribe({
      next: (r) => {
        this.roles.set(r.roles);
        this.catalogo.set(r.catalogo);
        this.cambios.set({});
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeErrorRoles(e));
        this.cargando.set(false);
      }
    });
  }

  nivel(rol: RolMatriz, codigo: string): NivelPermiso {
    return nivelActual(rol, this.cambios(), codigo);
  }

  modificada(rol: RolMatriz, codigo: string): boolean {
    return estaModificada(this.cambios(), rol.id, codigo);
  }

  onNivel(rol: RolMatriz, codigo: string, valor: string): void {
    if (celdaBloqueada(rol, codigo)) return;
    this.guardadoOk.set(false);
    this.errorGuardado.set(null);
    this.confirmando.set(false);
    this.cambios.update((c) => aplicarCambio(c, rol, codigo, valor as NivelPermiso));
  }

  restablecer(): void {
    this.cambios.set({});
    this.confirmando.set(false);
    this.errorGuardado.set(null);
  }

  pedirConfirmacion(): void {
    if (this.pendientes() > 0) this.confirmando.set(true);
  }

  cancelarConfirmacion(): void {
    this.confirmando.set(false);
  }

  async guardar(): Promise<void> {
    const cambios = this.cambios();
    const afectados = this.rolesAfectados();
    this.guardando.set(true);
    this.errorGuardado.set(null);
    this.guardadoOk.set(false);
    let fallo: string | null = null;
    for (const rol of afectados) {
      try {
        await firstValueFrom(this.svc.actualizarPermisos(rol.id, permisosAEnviar(rol, cambios)));
      } catch (e) {
        fallo = `No se pudo guardar el rol «${rol.nombre}»: ${mensajeErrorRoles(e)}`;
        break;
      }
    }
    const propioCambio = afectados.some((r) => r.codigo === this.session.usuario()?.rol);
    this.guardando.set(false);
    this.confirmando.set(false);
    // Recargar siempre: refleja lo guardado (tambien si hubo fallo parcial).
    await this.recargarTrasGuardar();
    if (propioCambio) {
      try {
        const { usuario } = await firstValueFrom(this.svc.sesionActual());
        this.session.actualizarUsuario(usuario);
      } catch {
        // la sesion se revalidara en la siguiente navegacion
      }
    }
    this.errorGuardado.set(fallo);
    this.guardadoOk.set(!fallo);
  }

  private async recargarTrasGuardar(): Promise<void> {
    try {
      const r = await firstValueFrom(this.svc.listar());
      this.roles.set(r.roles);
      this.catalogo.set(r.catalogo);
      this.cambios.set({});
    } catch (e) {
      this.error.set(mensajeErrorRoles(e));
    }
  }
}
