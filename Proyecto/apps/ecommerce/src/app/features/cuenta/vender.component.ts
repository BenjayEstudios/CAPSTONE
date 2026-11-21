import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { AuthError, AuthService } from "../../core/auth/auth.service";
import { RegistroProveedorRequest, RegistroProveedorResponse } from "../../core/models/auth.models";
import { clavesIgualesValidator, claveValidator, formatearRut, normalizarRut, rutValidator } from "../../shared/validacion/validadores";

// /vender (KAN-100): "Vender en Cotizapp". Una distribuidora pide su alta con
// los datos legales de la empresa (razon social, RUT, giro), los de su
// representante y el contacto. El backend crea la organizacion en_revision y
// abre el caso de moderacion alta_proveedor; no hay sesion hasta que un
// administrador la apruebe (ni login ni ofertas).
@Component({
  selector: "app-vender",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./vender.component.html",
  styleUrl: "./cuenta.css"
})
export class VenderComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly form = this.fb.group(
    {
      razonSocial: ["", [Validators.required, Validators.maxLength(180)]],
      rutEmpresa: ["", [Validators.required, rutValidator]],
      nombreFantasia: ["", [Validators.maxLength(180)]],
      giro: ["", [Validators.required, Validators.maxLength(180)]],
      telefonoEmpresa: ["", [Validators.maxLength(24)]],
      nombre: ["", [Validators.required, Validators.maxLength(120)]],
      rut: ["", [Validators.required, rutValidator]],
      telefono: ["", [Validators.maxLength(24)]],
      email: ["", [Validators.required, Validators.email, Validators.maxLength(160)]],
      clave: ["", [Validators.required, claveValidator]],
      confirmar: ["", [Validators.required]]
    },
    { validators: clavesIgualesValidator }
  );
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly enviada = signal<{ respuesta: RegistroProveedorResponse; empresa: string; email: string } | null>(null);

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
    const datos: RegistroProveedorRequest = {
      nombre: v.nombre.trim(),
      email: v.email.trim(),
      clave: v.clave,
      rut: normalizarRut(v.rut) as string,
      telefono: opcional(v.telefono),
      empresa: {
        razonSocial: v.razonSocial.trim(),
        rut: normalizarRut(v.rutEmpresa) as string,
        nombreFantasia: opcional(v.nombreFantasia),
        giro: v.giro.trim(),
        telefono: opcional(v.telefonoEmpresa)
      }
    };
    try {
      const respuesta = await this.auth.registrarProveedor(datos);
      this.enviada.set({ respuesta, empresa: datos.empresa.nombreFantasia ?? datos.empresa.razonSocial, email: datos.email });
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : "Ocurrió un error inesperado.");
    } finally {
      this.cargando.set(false);
    }
  }
}
