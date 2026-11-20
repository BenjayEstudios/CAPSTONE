import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { provideRouter, Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { usuarioDePrueba } from "../../core/testing/usuario-de-prueba";
import { claveValidator, formatearRut, normalizarRut, rutValidator } from "../../shared/validacion/validadores";
import { RegistroComponent } from "./registro.component";
import { RestablecerClaveComponent } from "./restablecer-clave.component";

describe("validadores", () => {
  it("RUT: normaliza con o sin puntos y valida el digito verificador (incluida la K)", () => {
    expect(normalizarRut("15.234.567-4")).toBe("15234567-4");
    expect(normalizarRut("152345674")).toBe("15234567-4");
    expect(normalizarRut("15.234.567-9")).toBeNull();
    expect(normalizarRut("10.000.013-k")).toBe("10000013-K");
    expect(formatearRut("782345672")).toBe("78.234.567-2");
    expect(rutValidator(new FormControl("15.234.567-9"))).toEqual({ rut: true });
    expect(rutValidator(new FormControl(""))).toBeNull();
  });

  it("clave: 8 a 72 caracteres con letras y numeros", () => {
    expect(claveValidator(new FormControl("corta1"))).toEqual({ clave: "Usa al menos 8 caracteres." });
    expect(claveValidator(new FormControl("sololetras"))).toEqual({ clave: "Combina letras y números." });
    expect(claveValidator(new FormControl("Prueba2026"))).toBeNull();
  });
});

describe("RegistroComponent", () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  function llenar(c: RegistroComponent) {
    c.form.patchValue({ nombre: "Marta Rojas", email: "m@t.cl", rut: "15.234.567-4", clave: "Prueba2026", confirmar: "Prueba2026" });
  }

  it("persona: envia nombre y RUT normalizado, sin empresa; luego navega", async () => {
    const f = TestBed.createComponent(RegistroComponent);
    const c = f.componentInstance;
    const nav = spyOn(TestBed.inject(Router), "navigateByUrl").and.resolveTo(true);
    llenar(c);
    const p = c.enviar();
    const req = ctrl.expectOne(`${environment.apiUrl}/auth/registro/comprador`);
    expect(req.request.body).toEqual({ nombre: "Marta Rojas", email: "m@t.cl", clave: "Prueba2026", rut: "15234567-4", telefono: undefined, empresa: undefined });
    req.flush({ token: "t", usuario: usuarioDePrueba() });
    await p;
    expect(nav).toHaveBeenCalledWith("/");
  });

  it("empresa: exige razon social y RUT de la empresa, y los envia", async () => {
    const f = TestBed.createComponent(RegistroComponent);
    const c = f.componentInstance;
    llenar(c);
    c.form.controls.tipo.setValue("empresa");
    expect(c.form.invalid).toBeTrue();
    c.form.patchValue({ razonSocial: "La Marraqueta SpA", rutEmpresa: "78.234.567-2", giro: "Panaderia" });
    expect(c.form.valid).toBeTrue();
    const p = c.enviar();
    const req = ctrl.expectOne(`${environment.apiUrl}/auth/registro/comprador`);
    expect(req.request.body.empresa).toEqual({ razonSocial: "La Marraqueta SpA", rut: "78234567-2", nombreFantasia: undefined, giro: "Panaderia" });
    req.flush({ token: "t", usuario: usuarioDePrueba() });
    await p;
  });

  it("no envia si las contraseñas no coinciden o el RUT no es valido", async () => {
    const c = TestBed.createComponent(RegistroComponent).componentInstance;
    llenar(c);
    c.form.patchValue({ confirmar: "Otra2026" });
    await c.enviar();
    c.form.patchValue({ confirmar: "Prueba2026", rut: "15.234.567-9" });
    await c.enviar();
    ctrl.expectNone(`${environment.apiUrl}/auth/registro/comprador`);
  });
});

describe("RestablecerClaveComponent", () => {
  it("sin token en el enlace avisa y ofrece pedir uno nuevo", () => {
    TestBed.configureTestingModule({
      imports: [RestablecerClaveComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    const f = TestBed.createComponent(RestablecerClaveComponent);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("El enlace está incompleto");
    expect(f.nativeElement.querySelector("form")).toBeNull();
  });
});
