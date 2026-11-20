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
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/login`).flush({ mfaRequerido: true, enrolar: false, desafio: "d1" });
    await p;
    f.detectChanges();
    return { f, c };
  }

  it("muestra el campo de codigo tras el paso 1, sin QR si ya esta enrolado", async () => {
    const { f, c } = await hastaPaso2();
    expect(c.enMfa()).toBeTrue();
    expect(f.nativeElement.querySelector("#codigo")).not.toBeNull();
    expect(f.nativeElement.querySelector("img.qr")).toBeNull();
    c.volverAEmpezar();
  });

  it("primer ingreso con 2FA exigido: muestra el QR y la clave para la app", async () => {
    const f = TestBed.createComponent(LoginComponent);
    const c = f.componentInstance;
    c.form.setValue({ email: "a@b.cl", clave: "x" });
    const p = c.enviar();
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/login`).flush({ mfaRequerido: true, enrolar: true, desafio: "d1" });
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/mfa/enrolar`).flush({
      secreto: "ABCDEFGHIJKL", otpauthUrl: "otpauth://x", qrDataUrl: "data:image/png;base64,AA", desafio: "d2"
    });
    await p;
    f.detectChanges();
    expect(f.nativeElement.querySelector("img.qr")?.getAttribute("src")).toBe("data:image/png;base64,AA");
    expect(f.nativeElement.querySelector(".secreto")?.textContent).toContain("ABCD EFGH IJKL");
    c.volverAEmpezar();
  });

  it("enviar el formulario del paso 2 desde el DOM llama al backend (no recarga la pagina)", async () => {
    const { f, c } = await hastaPaso2();
    const input: HTMLInputElement = f.nativeElement.querySelector("#codigo");
    input.value = "123456";
    input.dispatchEvent(new Event("input"));
    const evento = new Event("submit", { cancelable: true });
    f.nativeElement.querySelector("form").dispatchEvent(evento);
    expect(evento.defaultPrevented).toBeTrue();
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/mfa`).flush({ error: { code: "MFA_INVALIDO" } }, { status: 401, statusText: "x" });
    await Promise.resolve();
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
