import { HttpClient } from "@angular/common/http";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { SessionState } from "../state/session.state";
import { authInterceptor } from "./auth.interceptor";

describe("authInterceptor", () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let session: SessionState;
  const router = jasmine.createSpyObj<Router>("Router", ["navigate"]);
  const usuario = { id: "1", nombre: "A", email: "a@b.cl", organizacionId: "o", rol: "administrador", permisos: {} };

  beforeEach(() => {
    localStorage.clear();
    router.navigate.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionState);
  });

  afterEach(() => {
    ctrl.verify();
    localStorage.clear();
  });

  it("agrega Authorization Bearer cuando hay token", () => {
    session.iniciar("tok", usuario);
    http.get(`${environment.apiUrl}/x`).subscribe();
    const req = ctrl.expectOne(`${environment.apiUrl}/x`);
    expect(req.request.headers.get("Authorization")).toBe("Bearer tok");
    req.flush({});
  });

  it("no agrega header sin token ni a URLs ajenas al backend", () => {
    http.get(`${environment.apiUrl}/x`).subscribe();
    expect(ctrl.expectOne(`${environment.apiUrl}/x`).request.headers.has("Authorization")).toBeFalse();
    session.iniciar("tok", usuario);
    http.get("https://otro.com/y").subscribe();
    const req = ctrl.expectOne("https://otro.com/y");
    expect(req.request.headers.has("Authorization")).toBeFalse();
    req.flush({});
  });

  it("ante 401 limpia la sesion y redirige a /login", () => {
    session.iniciar("tok", usuario);
    http.get(`${environment.apiUrl}/x`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${environment.apiUrl}/x`).flush({}, { status: 401, statusText: "Unauthorized" });
    expect(session.token()).toBeNull();
    expect(session.usuario()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(["/login"], { queryParams: { motivo: "expirada" } });
  });

  it("el 401 del login no redirige", () => {
    http.post(`${environment.apiUrl}/auth/admin/login`, {}).subscribe({ error: () => undefined });
    ctrl.expectOne(`${environment.apiUrl}/auth/admin/login`).flush({}, { status: 401, statusText: "Unauthorized" });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("otros errores no tocan la sesion", () => {
    session.iniciar("tok", usuario);
    http.get(`${environment.apiUrl}/x`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${environment.apiUrl}/x`).flush({}, { status: 500, statusText: "Error" });
    expect(session.token()).toBe("tok");
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
