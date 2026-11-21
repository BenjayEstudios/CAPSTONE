import { Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { destinoSeguro } from "../../core/auth/guards";
import { RegistroCompradorRequest } from "../../core/models/auth.models";
import { clavesIgualesValidator, claveValidator, formatearRut, normalizarRut, rutValidator } from "../../shared/validacion/validadores";
import { PanelCuentaComponent } from "./panel-cuenta.component";

// /registro (KAN-97): cuenta de comprador. El backend crea la organizacion
// tipo cliente + el usuario con rol comprador y deja la sesion iniciada.
// Persona: la organizacion lleva su nombre y RUT. Empresa: razon social y
// RUT de la empresa (para la factura), y el RUT de quien se registra.
@Component({
  selector: "app-registro",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PanelCuentaComponent],
  templateUrl: "./registro.component.html",
  styleUrl: "./cuenta.css"
})
export class RegistroComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly returnUrl = destinoSeguro(inject(ActivatedRoute).snapshot.queryParamMap.get("returnUrl"));

  readonly form = this.fb.group(
    {
      tipo: this.fb.control<"persona" | "empresa">("persona"),
      nombre: ["", [Validators.required, Validators.maxLength(120)]],
      email: ["", [Validators.required, Validators.email, Validators.maxLength(160)]],
      rut: ["", [Validators.required, rutValidator]],
      telefono: ["", [Validators.maxLength(24)]],
      razonSocial: ["", [Validators.maxLength(180)]],
      rutEmpresa: ["", [rutValidator]],
      nombreFantasia: ["", [Validators.maxLength(180)]],
      giro: ["", [Validators.maxLength(180)]],
      clave: ["", [Validators.required, claveValidator]],
      confirmar: ["", [Validators.required]]
    },
    { validators: clavesIgualesValidator }
  );
  readonly tipo = toSignal(this.form.controls.tipo.valueChanges, { initialValue: this.form.controls.tipo.value });
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Los datos de empresa son obligatorios solo si elige "Empresa".
    this.form.controls.tipo.valueChanges.subscribe((tipo) => {
      const { razonSocial, rutEmpresa } = this.form.controls;
      razonSocial.setValidators(tipo === "empresa" ? [Validators.required, Validators.maxLength(180)] : [Validators.maxLength(180)]);
      rutEmpresa.setValidators(tipo === "empresa" ? [Validators.required, rutValidator] : [rutValidator]);
      razonSocial.updateValueAndValidity();
      rutEmpresa.updateValueAndValidity();
    });
  }

  /** Al salir del campo, muestra el RUT con puntos y guion si es valido. */
  formatear(control: "rut" | "rutEmpresa"): void {
    const c = this.form.controls[control];
    c.setValue(formatearRut(c.value));
  }

  invalido(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return c.touched && c.invalid;
  }

  async enviar(): Promise<void> {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    const opcional = (s: string) => s.trim() || undefined;
    const datos: RegistroCompradorRequest = {
      nombre: v.nombre.trim(),
      email: v.email.trim(),
      clave: v.clave,
      rut: normalizarRut(v.rut) as string,
      telefono: opcional(v.telefono),
      empresa:
        v.tipo === "empresa"
          ? {
              razonSocial: v.razonSocial.trim(),
              rut: normalizarRut(v.rutEmpresa) as string,
              nombreFantasia: opcional(v.nombreFantasia),
              giro: opcional(v.giro)
            }
          : undefined
    };
    try {
      await this.auth.registrarComprador(datos);
      await this.router.navigateByUrl(this.returnUrl);
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }
}
