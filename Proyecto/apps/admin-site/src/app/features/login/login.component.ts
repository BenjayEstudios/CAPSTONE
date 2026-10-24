import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { BRAND } from "../../core/config/brand";
import { RUTA_INICIO } from "../../core/navigation/modulos.config";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css"
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly brand = BRAND;
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    clave: ["", [Validators.required]]
  });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(
    this.route.snapshot.queryParamMap.get("motivo") === "expirada"
      ? "Tu sesión expiró. Ingresa nuevamente para continuar."
      : null
  );

  async enviar(): Promise<void> {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigateByUrl(this.destino());
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }

  // Solo rutas internas, para evitar redirecciones abiertas.
  private destino(): string {
    const url = this.route.snapshot.queryParamMap.get("returnUrl");
    return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/login") ? url : RUTA_INICIO;
  }
}
