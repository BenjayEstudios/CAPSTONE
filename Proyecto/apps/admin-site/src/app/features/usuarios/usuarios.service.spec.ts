import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { UsuariosService } from "./usuarios.service";
import {
  leerOrden, leerPagina, leerTamano, mensajeErrorUsuario, resumenResultados, siguienteOrdenPorNombre, validarFormulario
} from "./usuarios.util";

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
    expect(u.searchParams.get("orden")).toBeNull(); // "reciente" es el valor por defecto: no viaja
    req.flush({ items: [], pagina: 3, tamano: 20, orden: "reciente", total: 0, totalExacto: true, totalPaginas: 1, hayMas: false });
  });

  it("envia orden y tamano cuando no son los de por defecto", () => {
    svc.listar({ orden: "nombre_asc", tamano: 50 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/usuarios?`));
    const u = new URL(req.request.urlWithParams, "http://x");
    expect(u.searchParams.get("orden")).toBe("nombre_asc");
    expect(u.searchParams.get("tamano")).toBe("50");
    req.flush({ items: [], pagina: 1, tamano: 50, orden: "nombre_asc", total: 0, totalExacto: true, totalPaginas: 1, hayMas: false });
  });

  it("buscarOrganizaciones consulta por texto o por id, nunca el catalogo completo", () => {
    svc.buscarOrganizaciones({ q: " panad " }).subscribe();
    const a = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/usuarios/organizaciones?`));
    expect(new URL(a.request.urlWithParams, "http://x").searchParams.get("q")).toBe("panad");
    a.flush({ items: [] });
    svc.buscarOrganizaciones({ id: "7", q: "ignorado" }).subscribe();
    const b = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/usuarios/organizaciones?`));
    const ub = new URL(b.request.urlWithParams, "http://x");
    expect(ub.searchParams.get("id")).toBe("7");
    expect(ub.searchParams.get("q")).toBeNull();
    b.flush({ items: [] });
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
  it("leerOrden/leerTamano/leerPagina descartan valores no permitidos de la URL", () => {
    expect(leerOrden("nombre_desc")).toBe("nombre_desc");
    expect(leerOrden("DROP")).toBe("reciente");
    expect(leerOrden(null)).toBe("reciente");
    expect(leerTamano("50")).toBe(50);
    expect(leerTamano("5000")).toBe(20);
    expect(leerTamano("abc")).toBe(20);
    expect(leerPagina("3")).toBe(3);
    expect(leerPagina("-2")).toBe(1);
    expect(leerPagina("2.9")).toBe(2);
    expect(leerPagina("99999999")).toBe(100000);
    expect(leerPagina(null)).toBe(1);
  });
  it("siguienteOrdenPorNombre cicla A-Z, Z-A, recientes", () => {
    expect(siguienteOrdenPorNombre("reciente")).toBe("nombre_asc");
    expect(siguienteOrdenPorNombre("antiguo")).toBe("nombre_asc");
    expect(siguienteOrdenPorNombre("nombre_asc")).toBe("nombre_desc");
    expect(siguienteOrdenPorNombre("nombre_desc")).toBe("reciente");
  });
  it("resumenResultados indica rango y si el total esta acotado", () => {
    expect(resumenResultados({ pagina: 1, tamano: 20, cantidad: 0, total: 0, totalExacto: true })).toBe("Sin resultados");
    expect(resumenResultados({ pagina: 1, tamano: 20, cantidad: 7, total: 7, totalExacto: true })).toBe("Mostrando 1–7 de 7");
    expect(resumenResultados({ pagina: 3, tamano: 20, cantidad: 20, total: 1234, totalExacto: true })).toBe(
      `Mostrando 41–60 de ${(1234).toLocaleString("es-CL")}`
    );
    expect(resumenResultados({ pagina: 1, tamano: 20, cantidad: 20, total: 10000, totalExacto: false })).toContain("de más de ");
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
