import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { LoginComponent } from "./login.component";

describe("LoginComponent (2FA)", () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  async function hastaPaso2() {
    const f = TestBed.createComponent(LoginComponent);
    const c = f.componentInstance;
    c.form.setValue({ email: "a@b.cl", clave: "x" });
    const p = c.enviar();
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/login`).flush({ mfaRequerido: true, desafio: "d1" });
    await p;
    f.detectChanges();
    return { f, c };
  }

  it("muestra el campo de codigo tras el paso 1 y arranca el enfriamiento", async () => {
    const { f, c } = await hastaPaso2();
    expect(c.enMfa()).toBeTrue();
    expect(c.enfriamiento()).toBe(30);
    expect(f.nativeElement.querySelector("#codigo")).not.toBeNull();
    c.volverAEmpezar();
  });

  it("rechaza codigos que no son 6 digitos sin llamar al backend", async () => {
    const { c } = await hastaPaso2();
    c.codigo.setValue("12ab56");
    await c.verificar();
    expect(c.codigo.invalid).toBeTrue();
    c.volverAEmpezar();
  });

  it("codigo incorrecto vuelve al paso 1 con mensaje", async () => {
    const { c } = await hastaPaso2();
    c.codigo.setValue("123456");
    const p = c.verificar();
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/mfa`).flush({ error: { code: "MFA_INVALIDO" } }, { status: 401, statusText: "x" });
    await p;
    expect(c.enMfa()).toBeFalse();
    expect(c.error()).toContain("incorrecto o expiró");
  });
});
