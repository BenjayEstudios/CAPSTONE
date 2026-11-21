import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { clavesIgualesValidator, claveValidator } from "../../shared/validacion/validadores";
import { PanelCuentaComponent } from "./panel-cuenta.component";

// /restablecer-clave?token=... (KAN-97): la pagina que abre el enlace del
// correo de recuperacion (lo arma el backend con ECOMMERCE_URL). El enlace
// sirve una sola vez y vence a los 30 minutos.
@Component({
  selector: "app-restablecer-clave",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PanelCuentaComponent],
  styleUrl: "./cuenta.css",
  template: `
    <div class="contenedor pagina">
      <app-panel-cuenta />
      <section class="tarjeta" aria-labelledby="titulo-restablecer">
        <h2 id="titulo-restablecer">Crea una contraseña nueva</h2>
        @if (!token) {
          <p class="mensaje error" role="alert">El enlace está incompleto. Ábrelo de nuevo desde el correo o pide uno nuevo.</p>
          <p class="pie-form"><a routerLink="/recuperar-clave">Pedir un enlace nuevo</a></p>
        } @else {
          <p class="sub">Después podrás ingresar con ella.</p>
          <form class="form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
            @if (error()) {
              <p class="mensaje error" role="alert">
                {{ error() }}
                @if (enlaceInvalido()) { <a routerLink="/recuperar-clave">Pedir un enlace nuevo</a> }
              </p>
            }
            <div class="field">
              <label for="clave">Contraseña nueva</label>
              <input id="clave" class="input" type="password" formControlName="clave" autocomplete="new-password" />
              @if (form.controls.clave.touched && form.controls.clave.errors?.["clave"]) {
                <span class="ayuda error">{{ form.controls.clave.errors?.["clave"] }}</span>
              } @else {
                <span class="ayuda">Al menos 8 caracteres, con letras y números.</span>
              }
            </div>
            <div class="field">
              <label for="confirmar">Repite la contraseña</label>
              <input id="confirmar" class="input" type="password" formControlName="confirmar" autocomplete="new-password" />
              @if (form.controls.confirmar.touched && form.errors?.["clavesDistintas"]) {
                <span class="ayuda error">Las contraseñas no coinciden.</span>
              }
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="cargando()">
              {{ cargando() ? "Guardando..." : "Guardar contraseña" }}
            </button>
          </form>
        }
      </section>
    </div>
  `
})
export class RestablecerClaveComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get("token");
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      clave: ["", [Validators.required, claveValidator]],
      confirmar: ["", [Validators.required]]
    },
    { validators: clavesIgualesValidator }
  );
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly enlaceInvalido = signal(false);

  async enviar(): Promise<void> {
    if (!this.token || this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.restablecerClave(this.token, this.form.controls.clave.value);
      await this.router.navigate(["/ingresar"], { queryParams: { motivo: "clave" } });
    } catch (err) {
      this.enlaceInvalido.set(err instanceof AuthError && err.code === "ENLACE_INVALIDO");
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }
}
