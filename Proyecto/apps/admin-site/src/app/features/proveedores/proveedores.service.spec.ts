import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { ProveedoresService, construirParams } from "./proveedores.service";
import {
  accionesPermitidas, mensajeErrorProveedor, normalizarComision, validarComision, validarMotivo
} from "./proveedores.util";

const base = environment.apiUrl;

describe("ProveedoresService", () => {
  let svc: ProveedoresService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(ProveedoresService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista con query params y normaliza comision string", () => {
    let comision: number | null | undefined;
    svc.listar({ estado: "en_revision", q: " abc ", pagina: 2, tamano: 20 }).subscribe((r) => (comision = r.items[0].comisionPct));
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/proveedores?`));
    const url = new URL(req.request.urlWithParams, "http://x");
    expect(url.searchParams.get("estado")).toBe("en_revision");
    expect(url.searchParams.get("q")).toBe("abc");
    expect(url.searchParams.get("pagina")).toBe("2");
    expect(url.searchParams.get("tamano")).toBe("20");
    req.flush({
      items: [{ id: "1", razonSocial: "X", nombreFantasia: null, rut: "1-9", estado: "activa", comisionPct: "12.50", creadaEn: "2026-01-01",
        documentos: { total: 3, pendientes: 1, aprobados: 2, rechazados: 0 } }],
      pagina: 2, tamano: 20, total: 1, totalPaginas: 1
    });
    expect(comision).toBe(12.5);
  });

  it("omite filtros vacios", () => {
    const p = construirParams({ estado: "", q: " " });
    expect(p.has("estado")).toBeFalse();
    expect(p.has("q")).toBeFalse();
    expect(p.get("pagina")).toBe("1");
  });

  it("obtiene la ficha", () => {
    svc.obtener("7").subscribe();
    const req = http.expectOne(`${base}/proveedores/7`);
    expect(req.request.method).toBe("GET");
    req.flush({ id: "7", comisionPct: null, documentos: [], requisitos: { documentosFaltantes: [], puedeAprobar: true } });
  });

  it("revisa un documento (PATCH)", () => {
    svc.revisarDocumento("7", "d1", "rechazado", "ilegible").subscribe();
    const req = http.expectOne(`${base}/proveedores/7/documentos/d1/revision`);
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual({ decision: "rechazado", motivo: "ilegible" });
    req.flush({});
  });

  it("aprueba con y sin comision", () => {
    svc.aprobar("7", 10).subscribe();
    const r1 = http.expectOne(`${base}/proveedores/7/aprobar`);
    expect(r1.request.method).toBe("POST");
    expect(r1.request.body).toEqual({ comisionPct: 10 });
    r1.flush({ id: "7", estado: "activa", comisionPct: "10.00" });
    svc.aprobar("7", null).subscribe();
    const r2 = http.expectOne(`${base}/proveedores/7/aprobar`);
    expect(r2.request.body).toEqual({});
    r2.flush({ id: "7", estado: "activa", comisionPct: null });
  });

  it("rechaza y suspende con motivo", () => {
    svc.rechazar("7", "m1").subscribe();
    const r1 = http.expectOne(`${base}/proveedores/7/rechazar`);
    expect(r1.request.body).toEqual({ motivo: "m1" });
    r1.flush({ id: "7", estado: "suspendida", comisionPct: null });
    svc.suspender("7", "m2").subscribe();
    const r2 = http.expectOne(`${base}/proveedores/7/suspender`);
    expect(r2.request.body).toEqual({ motivo: "m2" });
    r2.flush({ id: "7", estado: "suspendida", comisionPct: null });
  });
});

describe("proveedores.util", () => {
  it("normaliza comision", () => {
    expect(normalizarComision("12.5")).toBe(12.5);
    expect(normalizarComision(8)).toBe(8);
    expect(normalizarComision(null)).toBeNull();
    expect(normalizarComision("abc")).toBeNull();
  });

  it("acciones permitidas por estado", () => {
    expect(accionesPermitidas("en_revision")).toEqual({ aprobar: true, rechazar: true, suspender: true });
    expect(accionesPermitidas("activa")).toEqual({ aprobar: false, rechazar: false, suspender: true });
    expect(accionesPermitidas("suspendida")).toEqual({ aprobar: true, rechazar: false, suspender: false });
  });

  it("valida comision y motivo", () => {
    expect(validarComision("").valor).toBeNull();
    expect(validarComision("15,5").valor).toBe(15.5);
    expect(validarComision("101").error).toBeTruthy();
    expect(validarComision("-1").error).toBeTruthy();
    expect(validarMotivo("  ")).toBeTruthy();
    expect(validarMotivo("a".repeat(241))).toBeTruthy();
    expect(validarMotivo("ok")).toBeNull();
  });

  it("mensajes de error en español", () => {
    const e = (status: number, code: string, message = "") => ({ status, error: { error: { code, message } } });
    expect(mensajeErrorProveedor(e(409, "REQUISITOS_INCOMPLETOS", "faltan: vigencia"))).toContain("faltan: vigencia");
    expect(mensajeErrorProveedor(e(409, "TRANSICION_INVALIDA"))).toContain("estado actual");
    expect(mensajeErrorProveedor(e(404, "PROVEEDOR_NO_ENCONTRADO"))).toContain("proveedor");
    expect(mensajeErrorProveedor(e(403, "FORBIDDEN"))).toContain("permiso");
  });
});
