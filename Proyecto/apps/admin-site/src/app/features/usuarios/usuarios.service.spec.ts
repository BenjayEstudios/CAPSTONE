import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { UsuariosService } from "./usuarios.service";
import { mensajeErrorUsuario, validarFormulario } from "./usuarios.util";

const base = environment.apiUrl;

describe("UsuariosService", () => {
  let svc: UsuariosService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(UsuariosService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista con filtros como query params", () => {
    svc.listar({ rolId: "2", estado: "activo", q: " ana ", pagina: 3 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/usuarios?`));
    const u = new URL(req.request.urlWithParams, "http://x");
    expect(u.searchParams.get("rolId")).toBe("2");
    expect(u.searchParams.get("estado")).toBe("activo");
    expect(u.searchParams.get("q")).toBe("ana");
    expect(u.searchParams.get("pagina")).toBe("3");
    expect(u.searchParams.get("organizacionId")).toBeNull();
    req.flush({ items: [], pagina: 3, tamano: 20, total: 0, totalPaginas: 1 });
  });

  it("crear, actualizar, suspender y reactivar usan el metodo y ruta correctos", () => {
    svc.crear({ nombre: "A", email: "a@b.cl", rolId: 1, organizacionId: 1, modo: "invitacion" }).subscribe();
    expect(http.expectOne(`${base}/usuarios`).request.method).toBe("POST");
    svc.actualizar(4, { nombre: "B" }).subscribe();
    expect(http.expectOne(`${base}/usuarios/4`).request.method).toBe("PATCH");
    svc.suspender(4).subscribe();
    expect(http.expectOne(`${base}/usuarios/4/suspender`).request.method).toBe("POST");
    svc.reactivar(4).subscribe();
    expect(http.expectOne(`${base}/usuarios/4/reactivar`).request.method).toBe("POST");
  });
});

describe("usuarios.util", () => {
  it("mensajeErrorUsuario prioriza el mensaje del servidor", () => {
    expect(mensajeErrorUsuario({ error: { error: { message: "Ya existe" } } }, "x")).toBe("Ya existe");
    expect(mensajeErrorUsuario({ status: 0 }, "x")).toContain("conexión");
    expect(mensajeErrorUsuario({}, "defecto")).toBe("defecto");
  });
  it("validarFormulario", () => {
    const ok = { nombre: "A", email: "a@b.cl", rolId: "1", organizacionId: "1" };
    expect(validarFormulario(ok, true)).toBeNull();
    expect(validarFormulario({ ...ok, nombre: " " }, true)).toContain("nombre");
    expect(validarFormulario({ ...ok, email: "mal" }, true)).toContain("email");
    expect(validarFormulario({ ...ok, email: "mal" }, false)).toBeNull();
    expect(validarFormulario({ ...ok, rolId: "" }, true)).toContain("rol");
  });
});
