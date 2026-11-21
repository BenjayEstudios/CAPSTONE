import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { SessionState } from "../../core/state/session.state";
import { VenderComponent } from "./vender.component";

const API = environment.apiUrl;

describe("Vender en Cotizapp (KAN-100)", () => {
  let ctrl: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({ imports: [VenderComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(VenderComponent);
    f.detectChanges();
    return f;
  }
  const llenar = (c: VenderComponent) =>
    c.form.setValue({
      razonSocial: "Distribuidora Prueba Ltda.", rutEmpresa: "76.555.444-6", nombreFantasia: "Prueba Foods", giro: "Distribución de alimentos",
      telefonoEmpresa: "", nombre: "Rita Prueba", rut: "15.222.333-1", telefono: "+56 9 1111 2222",
      email: "ventas@prueba.test", clave: "Clave1234", confirmar: "Clave1234"
    });

  beforeEach(() => localStorage.clear());

  it("pide datos legales (razon social, RUT, giro), representante y contacto antes de enviar", async () => {
    const f = montar();
    await f.componentInstance.enviar();
    f.detectChanges();
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Escribe la razón social.");
    expect(texto).toContain("Escribe el RUT de la empresa.");
    expect(texto).toContain("Escribe el giro de la empresa.");
    expect(texto).toContain("Escribe el nombre del representante.");
    expect(texto).toContain("Escribe el RUT del representante.");
    ctrl.expectNone(`${API}/auth/registro/proveedor`);
    f.componentInstance.form.controls.rutEmpresa.setValue("76.555.444-1");
    f.componentInstance.form.controls.rutEmpresa.markAsTouched();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("el dígito verificador no calza");
  });

  it("envia la solicitud con RUT normalizados y muestra que quedo en revision, sin iniciar sesion", async () => {
    const f = montar();
    llenar(f.componentInstance);
    const p = f.componentInstance.enviar();
    const req = ctrl.expectOne(`${API}/auth/registro/proveedor`);
    expect(req.request.body).toEqual({
      nombre: "Rita Prueba", email: "ventas@prueba.test", clave: "Clave1234", rut: "15222333-1", telefono: "+56 9 1111 2222",
      empresa: { razonSocial: "Distribuidora Prueba Ltda.", rut: "76555444-6", nombreFantasia: "Prueba Foods", giro: "Distribución de alimentos", telefono: undefined }
    });
    req.flush({ organizacionId: 38, estado: "en_revision", mensaje: "x" }, { status: 201, statusText: "Created" });
    await p;
    f.detectChanges();
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Recibimos la solicitud de Prueba Foods");
    expect(texto).toContain("en revisión");
    expect(texto).toContain("ventas@prueba.test");
    expect(TestBed.inject(SessionState).autenticado()).toBeFalse();
  });

  it("RUT ya registrado: lo explica y deja el formulario", async () => {
    const f = montar();
    llenar(f.componentInstance);
    const p = f.componentInstance.enviar();
    ctrl.expectOne(`${API}/auth/registro/proveedor`).flush({ error: { code: "RUT_EN_USO" } }, { status: 409, statusText: "x" });
    await p;
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("Ya hay una cuenta registrada con ese RUT.");
    expect(f.nativeElement.querySelector("form")).not.toBeNull();
  });
});
