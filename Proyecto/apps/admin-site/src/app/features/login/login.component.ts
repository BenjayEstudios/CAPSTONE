import { Component, computed, ElementRef, inject, signal, viewChild } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { BRAND } from "../../core/config/brand";
import { RUTA_INICIO } from "../../core/navigation/modulos.config";

// Codigos de AuthError tras los cuales hay que volver a empezar (paso 1).
export const ERRORES_MFA_REINICIAN = ["MFA_INVALIDO", "MFA_DEMASIADOS_INTENTOS"];

// Login del panel con 2FA TOTP (KAN-144):
// 1. correo y clave;
// 2a. usuario enrolado: codigo de 6 digitos de su app autenticadora;
// 2b. primer ingreso con 2FA exigido: QR para configurar la app y su primer codigo.
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
  readonly codigo = inject(FormBuilder).nonNullable.control("", [Validators.required, Validators.pattern(/^\d{6}$/)]);
  // Grupo del paso 2: sin [formGroup] el <form> no tiene directiva de Angular,
  // (ngSubmit) nunca se emite y el navegador hace un submit nativo que recarga la pagina.
  readonly formMfa = new FormGroup({ codigo: this.codigo });
  /** Paso 2 visible mientras haya un desafio 2FA pendiente. */
  readonly enMfa = computed(() => this.auth.desafioMfa() !== null);
  /** QR y secreto mientras el usuario configura su app (null si ya estaba enrolado). */
  readonly enrolamiento = this.auth.enrolamiento;
  /** Secreto en grupos de 4 para copiarlo a mano sin errores. */
  readonly secretoAgrupado = computed(() => this.enrolamiento()?.secreto.match(/.{1,4}/g)?.join(" ") ?? "");
  readonly inputCodigo = viewChild<ElementRef<HTMLInputElement>>("inputCodigo");
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
      if (r === "enrolar") await this.auth.iniciarEnrolamiento();
      if (r !== "sesion") {
        this.codigo.reset("");
        setTimeout(() => this.inputCodigo()?.nativeElement.focus());
        return;
      }
      await this.router.navigateByUrl(this.destino());
    } catch (err) {
      this.manejarErrorMfa(err);
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
      await this.router.navigateByUrl(this.destino());
    } catch (err) {
      this.manejarErrorMfa(err);
    } finally {
      this.cargando.set(false);
    }
  }

  volverAEmpezar(): void {
    this.auth.cancelarMfa();
    this.codigo.reset("");
    this.error.set(null);
    this.aviso.set(null);
  }

  private manejarErrorMfa(err: unknown): void {
    if (err instanceof AuthError) {
      if (ERRORES_MFA_REINICIAN.includes(err.code)) this.volverAEmpezar();
      this.error.set(err.message);
    } else {
      this.error.set("Ocurrió un error inesperado.");
    }
  }

  // Solo rutas internas, para evitar redirecciones abiertas.
  private destino(): string {
    const url = this.route.snapshot.queryParamMap.get("returnUrl");
    return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/login") ? url : RUTA_INICIO;
  }
}
