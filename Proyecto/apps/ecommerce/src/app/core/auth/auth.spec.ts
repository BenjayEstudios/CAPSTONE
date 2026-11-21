import { HttpClient, provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router, UrlTree } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import { SESION_STORAGE_KEY, SessionState } from "../state/session.state";
import { usuarioDePrueba } from "../testing/usuario-de-prueba";
import { authInterceptor } from "./auth.interceptor";
import { AuthService } from "./auth.service";
import { destinoSeguro, sesionGuard } from "./guards";

const url = (p: string) => `${environment.apiUrl}${p}`;

describe("Sesion del ecommerce (KAN-97)", () => {
  let auth: AuthService;
  let session: SessionState;
  let ctrl: HttpTestingController;

  function configurar() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    auth = TestBed.inject(AuthService);
    session = TestBed.inject(SessionState);
    ctrl = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    configurar();
  });
  afterEach(() => {
    ctrl.verify();
    localStorage.clear();
  });

  describe("AuthService", () => {
    it("ingresar guarda el JWT y el usuario, y la sesion sobrevive a recargar", async () => {
      const p = auth.ingresar("compras@lamarraqueta.test", "Prueba2026");
      const req = ctrl.expectOne(url("/auth/login"));
      expect(req.request.body).toEqual({ email: "compras@lamarraqueta.test", clave: "Prueba2026" });
      req.flush({ token: "jwt-1", usuario: usuarioDePrueba() });
      await p;
      expect(session.autenticado()).toBeTrue();
      expect(JSON.parse(localStorage.getItem(SESION_STORAGE_KEY)!).token).toBe("jwt-1");

      // Otra "carga de la pagina": un SessionState nuevo lee lo guardado.
      TestBed.resetTestingModule();
      configurar();
      expect(session.token()).toBe("jwt-1");
      expect(session.usuario()?.nombre).toBe("Marta Rojas");
    });

    it("rechaza cuentas internas (con o sin 2FA) sin guardar nada", async () => {
      const p1 = auth.ingresar("admin@cotizapp.test", "x");
      ctrl.expectOne(url("/auth/login")).flush({ token: "t", usuario: usuarioDePrueba({ organizacion: { id: 1, nombre: "Cotizapp", tipo: "interna" } }) });
      await expectAsync(p1).toBeRejectedWithError(/panel de administración/);
      const p2 = auth.ingresar("admin@cotizapp.test", "x");
      ctrl.expectOne(url("/auth/login")).flush({ mfaRequerido: true, enrolar: false, desafio: "d" });
      await expectAsync(p2).toBeRejectedWithError(/panel de administración/);
      expect(session.autenticado()).toBeFalse();
      expect(localStorage.getItem(SESION_STORAGE_KEY)).toBeNull();
    });

    it("traduce los errores del backend a textos para la persona", async () => {
      const p = auth.ingresar("x@y.cl", "mala");
      ctrl.expectOne(url("/auth/login")).flush({ error: { code: "CREDENCIALES_INVALIDAS" } }, { status: 401, statusText: "x" });
      await expectAsync(p).toBeRejectedWithError("Correo o contraseña incorrectos.");
      const r = auth.registrarComprador({ nombre: "A", email: "a@b.cl", clave: "Clave1234", rut: "11111111-1" });
      ctrl.expectOne(url("/auth/registro/comprador")).flush({ error: { code: "EMAIL_EN_USO" } }, { status: 409, statusText: "x" });
      await expectAsync(r).toBeRejectedWithError(/Ya existe una cuenta con ese correo/);
    });

    it("registrar deja la sesion iniciada; recuperar y restablecer llaman al backend", async () => {
      const r = auth.registrarComprador({ nombre: "Marta", email: "m@t.cl", clave: "Clave1234", rut: "15234567-4" });
      ctrl.expectOne(url("/auth/registro/comprador")).flush({ token: "jwt-2", usuario: usuarioDePrueba() });
      await r;
      expect(session.token()).toBe("jwt-2");

      const s = auth.solicitarRecuperacion("m@t.cl");
      const rec = ctrl.expectOne(url("/auth/recuperar"));
      expect(rec.request.body).toEqual({ email: "m@t.cl" });
      rec.flush({ ok: true });
      await s;
      const t = auth.restablecerClave("tok", "Nueva2026x");
      ctrl.expectOne(url("/auth/restablecer")).flush({ error: { code: "ENLACE_INVALIDO" } }, { status: 400, statusText: "x" });
      await expectAsync(t).toBeRejectedWithError(/expiró/);
    });

    it("confirmarSesion consulta /auth/me una sola vez por carga", async () => {
      session.iniciar("jwt", usuarioDePrueba());
      session.confirmada.set(false);
      const a = auth.confirmarSesion();
      const b = auth.confirmarSesion();
      ctrl.expectOne(url("/auth/me")).flush({ ...usuarioDePrueba(), organizacion: undefined, permisos: { nuevo: "total" } });
      expect(await a).toBeTrue();
      expect(await b).toBeTrue();
      expect(session.usuario()?.permisos).toEqual({ nuevo: "total" });
      expect(session.usuario()?.organizacion.nombre).toBe("La Marraqueta");
      expect(await auth.confirmarSesion()).toBeTrue(); // ya confirmada: sin otra llamada
    });
  });

  describe("authInterceptor", () => {
    it("agrega el Bearer a las llamadas al backend", async () => {
      session.iniciar("jwt-3", usuarioDePrueba());
      const p = firstValueFrom(TestBed.inject(HttpClient).get(url("/carro")));
      const req = ctrl.expectOne(url("/carro"));
      expect(req.request.headers.get("Authorization")).toBe("Bearer jwt-3");
      req.flush({});
      await p;
    });

    it("un 401 fuera de /auth limpia la sesion y lleva a /ingresar; el 401 del login no", async () => {
      const router = TestBed.inject(Router);
      const nav = spyOn(router, "navigate").and.resolveTo(true);
      session.iniciar("jwt", usuarioDePrueba());

      const login = firstValueFrom(TestBed.inject(HttpClient).post(url("/auth/login"), {}));
      ctrl.expectOne(url("/auth/login")).flush({}, { status: 401, statusText: "x" });
      await expectAsync(login).toBeRejected();
      expect(session.autenticado()).toBeTrue();

      const carro = firstValueFrom(TestBed.inject(HttpClient).get(url("/carro")));
      ctrl.expectOne(url("/carro")).flush({}, { status: 401, statusText: "x" });
      await expectAsync(carro).toBeRejected();
      expect(session.autenticado()).toBeFalse();
      expect(nav).toHaveBeenCalledWith(["/ingresar"], jasmine.objectContaining({ queryParams: jasmine.objectContaining({ motivo: "expirada" }) }));
    });
  });

  describe("guards", () => {
    it("sesionGuard sin sesion manda a /ingresar con returnUrl; con sesion deja pasar", async () => {
      const ejecutar = () =>
        TestBed.runInInjectionContext(() => sesionGuard({} as never, { url: "/checkout" } as never)) as Promise<boolean | UrlTree>;
      const sin = await ejecutar();
      expect(TestBed.inject(Router).serializeUrl(sin as UrlTree)).toBe("/ingresar?returnUrl=%2Fcheckout");
      session.iniciar("jwt", usuarioDePrueba());
      expect(await ejecutar()).toBeTrue();
    });

    it("destinoSeguro solo acepta rutas internas", () => {
      expect(destinoSeguro("/checkout")).toBe("/checkout");
      expect(destinoSeguro("https://malo.cl")).toBe("/");
      expect(destinoSeguro("//malo.cl")).toBe("/");
      expect(destinoSeguro("/ingresar")).toBe("/");
      expect(destinoSeguro(null)).toBe("/");
    });
  });
});
