import { Component, computed, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { BRAND } from "../../core/config/brand";
import { MODULOS } from "../../core/navigation/modulos.config";
import { SessionState } from "../../core/state/session.state";

// Layout compartido: header (nombre, rol, cerrar sesion) + sidebar de modulos
// filtrados por permisos + contenido.
@Component({
  selector: "app-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./shell.component.html",
  styleUrl: "./shell.component.css"
})
export class ShellComponent {
  private readonly session = inject(SessionState);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly brand = BRAND;
  readonly usuario = this.session.usuario;
  readonly menuAbierto = signal(false);
  readonly modulos = computed(() => MODULOS.filter((m) => m.permiso === null || this.session.tienePermiso(m.permiso)));
  /** Sin ninguna seccion con permiso (solo queda el Dashboard, que es siempre visible). */
  readonly sinSecciones = computed(() => this.modulos().every((m) => m.permiso === null));
  readonly fecha = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  cerrarSesion(): void {
    this.auth.logout();
    void this.router.navigate(["/login"]);
  }
}
