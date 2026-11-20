import { Component, computed, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { destinoSeguro } from "../../core/auth/guards";
import { SessionState } from "../../core/state/session.state";
import { PanelCuentaComponent } from "./panel-cuenta.component";

// /ingresar (KAN-97): correo y contraseña. Tras entrar vuelve a returnUrl
// (ej. el checkout que pidio sesion) o al inicio.
@Component({
  selector: "app-ingresar",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PanelCuentaComponent],
  templateUrl: "./ingresar.component.html",
  styleUrl: "./cuenta.css"
})
export class IngresarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionState);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    clave: ["", [Validators.required]]
  });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly returnUrl = destinoSeguro(this.query.get("returnUrl"));
  readonly aviso = computed(() => {
    if (this.query.get("motivo") === "expirada") return "Tu sesión expiró. Ingresa de nuevo para continuar.";
    if (this.query.get("motivo") === "clave") return "Listo, ya puedes ingresar con tu nueva contraseña.";
    if (this.returnUrl.startsWith("/checkout")) return "Ingresa para terminar tu compra. Tu carro te espera.";
    return null;
  });

  async enviar(): Promise<void> {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      const { email, clave } = this.form.getRawValue();
      await this.auth.ingresar(email.trim(), clave);
      // Un distribuidor que entra sin destino va a su panel (KAN-101).
      const destino = this.returnUrl === "/" && this.session.esProveedor() ? "/proveedor" : this.returnUrl;
      await this.router.navigateByUrl(destino);
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }
}
