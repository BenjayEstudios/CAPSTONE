import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { PanelCuentaComponent } from "./panel-cuenta.component";

// /recuperar-clave (KAN-97): pide el enlace por correo. El mensaje de exito
// es el mismo exista o no la cuenta (el backend no revela que correos existen).
@Component({
  selector: "app-recuperar-clave",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PanelCuentaComponent],
  styleUrl: "./cuenta.css",
  template: `
    <div class="contenedor pagina">
      <app-panel-cuenta />
      <section class="tarjeta" aria-labelledby="titulo-recuperar">
        <h2 id="titulo-recuperar">Recuperar contraseña</h2>
        @if (enviado()) {
          <p class="mensaje ok" role="status">
            Si hay una cuenta con <strong>{{ enviado() }}</strong>, te enviamos un enlace para crear una contraseña nueva.
            Vence en 30 minutos. Revisa también la carpeta de spam.
          </p>
          <p class="pie-form"><a routerLink="/ingresar">Volver a ingresar</a></p>
        } @else {
          <p class="sub">Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva.</p>
          <form class="form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
            @if (error()) {
              <p class="mensaje error" role="alert">{{ error() }}</p>
            }
            <div class="field">
              <label for="email">Correo electrónico</label>
              <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <span class="ayuda error">Escribe un correo válido.</span>
              }
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="cargando()">
              {{ cargando() ? "Enviando..." : "Enviar enlace" }}
            </button>
            <p class="pie-form"><a routerLink="/ingresar">Volver a ingresar</a></p>
          </form>
        }
      </section>
    </div>
  `
})
export class RecuperarClaveComponent {
  private readonly auth = inject(AuthService);
  readonly form = inject(FormBuilder).nonNullable.group({ email: ["", [Validators.required, Validators.email]] });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  /** Correo al que se pidio el enlace (null mientras no se envia). */
  readonly enviado = signal<string | null>(null);

  async enviar(): Promise<void> {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    const email = this.form.controls.email.value.trim();
    try {
      await this.auth.solicitarRecuperacion(email);
      this.enviado.set(email);
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }
}
