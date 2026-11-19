import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { SessionState, TOKEN_STORAGE_KEY } from "../state/session.state";
import { AuthService } from "./auth.service";

const usuario = { id: "1", nombre: "A", email: "a@b.cl", organizacionId: "o", rol: "editor_catalogo", permisos: {} };
const url = (p: string) => `${environment.apiUrl}${p}`;

describe("AuthService", () => {
  let auth: AuthService;
  let session: SessionState;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    session = TestBed.inject(SessionState);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    ctrl.verify();
    localStorage.clear();
  });

  async function login(respuesta: object) {
    const p = auth.login({ email: "a@b.cl", clave: "x" });
    ctrl.expectOne(url("/auth/admin/login")).flush(respuesta);
    return p;
  }

  it("acepta cualquier rol interno que el backend deje entrar", async () => {
    expect(await login({ token: "t", usuario })).toBe("sesion");
    expect(session.usuario()?.rol).toBe("editor_catalogo");
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("t");
  });

  it("con mfaRequerido NO guarda token y deja el desafio pendiente", async () => {
    expect(await login({ mfaRequerido: true, desafio: "d1" })).toBe("mfa");
    expect(session.token()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(auth.desafioMfa()).toBe("d1");
  });

  it("verificarMfa envia desafio y codigo, y recien ahi inicia sesion", async () => {
    await login({ mfaRequerido: true, desafio: "d1" });
    const p = auth.verificarMfa("123456");
    const req = ctrl.expectOne(url("/auth/admin/mfa"));
    expect(req.request.body).toEqual({ desafio: "d1", codigo: "123456" });
    req.flush({ token: "t", usuario });
    await p;
    expect(session.token()).toBe("t");
    expect(auth.desafioMfa()).toBeNull();
  });

  it("codigo incorrecto/expirado descarta el desafio y no inicia sesion", async () => {
    await login({ mfaRequerido: true, desafio: "d1" });
    const p = auth.verificarMfa("000000");
    ctrl.expectOne(url("/auth/admin/mfa")).flush({ error: { code: "MFA_INVALIDO" } }, { status: 401, statusText: "x" });
    await expectAsync(p).toBeRejectedWithError(/incorrecto o expiró/);
    expect(auth.desafioMfa()).toBeNull();
    expect(session.token()).toBeNull();
  });

  it("un error de red conserva el desafio para reintentar", async () => {
    await login({ mfaRequerido: true, desafio: "d1" });
    const p = auth.verificarMfa("111111");
    ctrl.expectOne(url("/auth/admin/mfa")).error(new ProgressEvent("error"));
    await expectAsync(p).toBeRejected();
    expect(auth.desafioMfa()).toBe("d1");
  });

  it("reenviarMfa reemplaza el desafio", async () => {
    await login({ mfaRequerido: true, desafio: "d1" });
    const p = auth.reenviarMfa();
    const req = ctrl.expectOne(url("/auth/admin/mfa/reenviar"));
    expect(req.request.body).toEqual({ desafio: "d1" });
    req.flush({ mfaRequerido: true, desafio: "d2" });
    await p;
    expect(auth.desafioMfa()).toBe("d2");
  });
});

describe("AuthService.restaurar con /auth/me plano", () => {
  it("acepta la respuesta plana del backend", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "tok");
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const auth = TestBed.inject(AuthService);
    const ctrl = TestBed.inject(HttpTestingController);
    const p = auth.restaurar();
    ctrl.expectOne(url("/auth/me")).flush(usuario);
    expect(await p).toBeTrue();
    expect(TestBed.inject(SessionState).usuario()?.rol).toBe("editor_catalogo");
    localStorage.clear();
  });
});
