import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { ModeracionService, construirParams } from "./moderacion.service";
import { accionesCaso, asignadoParaApi, mensajeErrorModeracion, rutaEntidad, validarTexto } from "./moderacion.util";

const base = environment.apiUrl;

describe("ModeracionService", () => {
  let svc: ModeracionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(ModeracionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista con query params", () => {
    svc.listar({ tipo: "reembolso", estado: "abierto", asignadoA: "sin_asignar", pagina: 2 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/moderacion/casos?`));
    const url = new URL(req.request.urlWithParams, "http://x");
    expect(url.searchParams.get("tipo")).toBe("reembolso");
    expect(url.searchParams.get("estado")).toBe("abierto");
    expect(url.searchParams.get("asignadoA")).toBe("sin_asignar");
    expect(url.searchParams.get("pagina")).toBe("2");
    expect(url.searchParams.get("tamano")).toBe("20");
    req.flush({ items: [], pagina: 2, tamano: 20, total: 0, totalPaginas: 1 });
  });

  it("omite filtros vacios", () => {
    const p = construirParams({ tipo: "", estado: "", asignadoA: "" });
    expect(p.has("tipo")).toBeFalse();
    expect(p.has("estado")).toBeFalse();
    expect(p.has("asignadoA")).toBeFalse();
  });

  it("detalle, internos y acciones", () => {
    svc.obtener(3).subscribe();
    const g = http.expectOne(`${base}/moderacion/casos/3`);
    expect(g.request.method).toBe("GET");
    g.flush({});
    svc.usuariosInternos().subscribe();
    http.expectOne(`${base}/moderacion/usuarios-internos`).flush({ items: [] });

    svc.asignar(3, 5).subscribe();
    const a = http.expectOne(`${base}/moderacion/casos/3/asignar`);
    expect(a.request.method).toBe("POST");
    expect(a.request.body).toEqual({ usuarioId: 5 });
    a.flush({});
    svc.asignar(3, null).subscribe();
    const b = http.expectOne(`${base}/moderacion/casos/3/asignar`);
    expect(b.request.body).toEqual({ usuarioId: null });
    b.flush({});
    svc.resolver(3, " ok ").subscribe();
    const r = http.expectOne(`${base}/moderacion/casos/3/resolver`);
    expect(r.request.body).toEqual({ nota: "ok" });
    r.flush({});
    svc.descartar(3, " dup ").subscribe();
    const d = http.expectOne(`${base}/moderacion/casos/3/descartar`);
    expect(d.request.body).toEqual({ motivo: "dup" });
    d.flush({});
  });
});

describe("moderacion.util", () => {
  it("ruta de entidad relacionada", () => {
    expect(rutaEntidad("organizacion", 4)).toEqual(["/proveedores", "4"]);
    expect(rutaEntidad("producto", 9)).toEqual(["/catalogo-maestro", "9"]);
    expect(rutaEntidad("orden", 1)).toBeNull();
  });
  it("acciones solo en casos abiertos", () => {
    expect(accionesCaso("abierto")).toEqual({ asignar: true, resolver: true, descartar: true });
    expect(accionesCaso("resuelto")).toEqual({ asignar: false, resolver: false, descartar: false });
  });
  it("valida texto obligatorio y largo", () => {
    expect(validarTexto("  ")).toBeTruthy();
    expect(validarTexto("a".repeat(501))).toBeTruthy();
    expect(validarTexto("ok")).toBeNull();
  });
  it("filtro asignado", () => {
    expect(asignadoParaApi("mi", "7")).toBe("7");
    expect(asignadoParaApi("sin_asignar", "7")).toBe("sin_asignar");
    expect(asignadoParaApi("", "7")).toBeUndefined();
  });
  it("mensajes de error", () => {
    const e = (status: number, code: string) => ({ status, error: { error: { code, message: "" } } });
    expect(mensajeErrorModeracion(e(409, "TRANSICION_INVALIDA"))).toContain("ya no está abierto");
    expect(mensajeErrorModeracion(e(403, "FORBIDDEN"))).toContain("permiso");
  });
});
