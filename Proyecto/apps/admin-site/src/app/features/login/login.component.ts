import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { BRAND } from "../../core/config/brand";
import { RUTA_INICIO } from "../../core/navigation/modulos.config";

export const ENFRIAMIENTO_REENVIO_SEG = 30;

// Codigos de AuthError tras los cuales hay que volver a empezar (paso 1).
export const ERRORES_MFA_REINICIAN = ["MFA_INVALIDO", "MFA_DEMASIADOS_INTENTOS"];

@Component({
  selector: "app-login",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css"
})
export class LoginComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly brand = BRAND;
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    clave: ["", [Validators.required]]
  });
  readonly codigo = inject(FormBuilder).nonNullable.control("", [Validators.required, Validators.pattern(/^\d{6}$/)]);
  /** Paso 2 visible mientras haya un desafio 2FA pendiente. */
  readonly enMfa = computed(() => this.auth.desafioMfa() !== null);
  readonly enfriamiento = signal(0);
  readonly inputCodigo = viewChild<ElementRef<HTMLInputElement>>("inputCodigo");
  private temporizador: ReturnType<typeof setInterval> | null = null;
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
      const r = await this.auth.login(this.form.getRawValue());
      if (r === "mfa") {
        this.codigo.reset("");
        this.iniciarEnfriamiento();
        setTimeout(() => this.inputCodigo()?.nativeElement.focus());
        return;
      }
      await this.router.navigateByUrl(this.destino());
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }

  async verificar(): Promise<void> {
    if (this.codigo.invalid || this.cargando()) {
      this.codigo.markAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.verificarMfa(this.codigo.value);
      this.detenerEnfriamiento();
      await this.router.navigateByUrl(this.destino());
    } catch (err) {
      this.manejarErrorMfa(err);
    } finally {
      this.cargando.set(false);
    }
  }

  async reenviar(): Promise<void> {
    if (this.enfriamiento() > 0 || this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.reenviarMfa();
      this.codigo.reset("");
      this.aviso.set("Enviamos un nuevo código a tu correo.");
      this.iniciarEnfriamiento();
    } catch (err) {
      this.manejarErrorMfa(err);
    } finally {
      this.cargando.set(false);
    }
  }

  volverAEmpezar(): void {
    this.auth.cancelarMfa();
    this.detenerEnfriamiento();
    this.codigo.reset("");
    this.error.set(null);
    this.aviso.set(null);
  }

  ngOnDestroy(): void {
    this.detenerEnfriamiento();
  }

  private manejarErrorMfa(err: unknown): void {
    if (err instanceof AuthError) {
      this.error.set(err.message);
      if (ERRORES_MFA_REINICIAN.includes(err.code)) this.volverAEmpezarConservandoError(err.message);
    } else {
      this.error.set("Ocurrió un error inesperado.");
    }
  }

  private volverAEmpezarConservandoError(mensaje: string): void {
    this.volverAEmpezar();
    this.error.set(mensaje);
  }

  private iniciarEnfriamiento(): void {
    this.detenerEnfriamiento();
    this.enfriamiento.set(ENFRIAMIENTO_REENVIO_SEG);
    this.temporizador = setInterval(() => {
      this.enfriamiento.update((n) => Math.max(0, n - 1));
      if (this.enfriamiento() === 0) this.detenerEnfriamiento();
    }, 1000);
  }

  private detenerEnfriamiento(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.enfriamiento.set(0);
  }

  // Solo rutas internas, para evitar redirecciones abiertas.
  private destino(): string {
    const url = this.route.snapshot.queryParamMap.get("returnUrl");
    return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/login") ? url : RUTA_INICIO;
  }
}
