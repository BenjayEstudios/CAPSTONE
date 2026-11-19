import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { environment } from "../../../environments/environment";
import { UsuarioSesion } from "../models/auth.models";
import { SessionState, TOKEN_STORAGE_KEY } from "../state/session.state";
import { sesionInternaGuard, guestGuard, permisoGuard } from "./guards";

const usuario = (rol = "administrador", permisos: UsuarioSesion["permisos"] = {}): UsuarioSesion => ({
  id: "1",
  nombre: "A",
  email: "a@b.cl",
  organizacionId: "o",
  rol,
  permisos
});

describe("guards", () => {
  let ctrl: HttpTestingController;
  let session: SessionState;
  let router: Router;

  const run = (guard: CanActivateFn, url = "/ordenes") =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as Promise<
      boolean | UrlTree
    >;

  function setup(token?: string) {
    localStorage.clear();
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionState);
    router = TestBed.inject(Router);
  }

  afterEach(() => {
    ctrl.verify();
    localStorage.clear();
  });

  it("sesionInternaGuard redirige a /login con returnUrl si no hay token", async () => {
    setup();
    const res = (await run(sesionInternaGuard)) as UrlTree;
    expect(router.serializeUrl(res)).toBe("/login?returnUrl=%2Fordenes");
  });

  it("sesionInternaGuard deja pasar con sesion de administrador en memoria", async () => {
    setup();
    session.iniciar("t", usuario());
    expect(await run(sesionInternaGuard)).toBeTrue();
  });

  it("sesionInternaGuard valida el token guardado con GET /auth/me", async () => {
    setup("tok");
    const p = run(sesionInternaGuard);
    const req = ctrl.expectOne(`${environment.apiUrl}/auth/me`);
    req.flush({ usuario: usuario() });
    expect(await p).toBeTrue();
    expect(session.usuario()?.rol).toBe("administrador");
    expect(session.validando()).toBeFalse();
  });

  it("sesionInternaGuard rechaza si /auth/me responde 401", async () => {
    setup("tok");
    const p = run(sesionInternaGuard);
    ctrl.expectOne(`${environment.apiUrl}/auth/me`).flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await p).toBeInstanceOf(UrlTree);
    expect(session.validando()).toBeFalse();
  });

  it("sesionInternaGuard deja pasar a un rol interno no administrador (editor_catalogo)", async () => {
    setup("tok");
    const p = run(sesionInternaGuard);
    ctrl.expectOne(`${environment.apiUrl}/auth/me`).flush({ usuario: usuario("editor_catalogo") });
    expect(await p).toBeTrue();
    expect(session.usuario()?.rol).toBe("editor_catalogo");
  });

  it("guestGuard deja ver /login sin sesion y redirige con sesion", async () => {
    setup();
    expect(await run(guestGuard, "/login")).toBeTrue();
    session.iniciar("t", usuario());
    const res = (await run(guestGuard, "/login")) as UrlTree;
    expect(router.serializeUrl(res)).toBe("/dashboard");
  });

  it("permisoGuard exige permiso parcial o total", async () => {
    setup();
    session.iniciar("t", usuario("administrador", { ver_auditoria: "total", crear_usuario: "ninguno" }));
    expect(await run(permisoGuard("ver_auditoria"))).toBeTrue();
    const res = (await run(permisoGuard("crear_usuario"))) as UrlTree;
    expect(router.serializeUrl(res)).toBe("/dashboard");
  });
});
