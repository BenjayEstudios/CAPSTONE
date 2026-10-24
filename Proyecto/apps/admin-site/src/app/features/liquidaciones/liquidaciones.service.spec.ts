import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { LiquidacionesService, construirParams } from "./liquidaciones.service";
import { clp, fechaCorta, mensajeErrorLiquidaciones, semanaAnteriorYmd, validarFechaPago, validarRango } from "./liquidaciones.util";

const base = environment.apiUrl;

describe("LiquidacionesService", () => {
  let svc: LiquidacionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(LiquidacionesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista con query params", () => {
    svc.listar({ proveedorId: 12, estado: "pendiente", desde: "2026-10-12", hasta: "2026-10-18", pagina: 2 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/liquidaciones?`));
    const url = new URL(req.request.urlWithParams, "http://x");
    expect(url.searchParams.get("proveedorId")).toBe("12");
    expect(url.searchParams.get("estado")).toBe("pendiente");
    expect(url.searchParams.get("desde")).toBe("2026-10-12");
    expect(url.searchParams.get("hasta")).toBe("2026-10-18");
    expect(url.searchParams.get("pagina")).toBe("2");
    expect(url.searchParams.get("tamano")).toBe("20");
    req.flush({ items: [], pagina: 2, tamano: 20, total: 0, totalPaginas: 1 });
  });

  it("omite filtros vacios", () => {
    const p = construirParams({ proveedorId: "", estado: "", desde: "", hasta: "" });
    expect(p.has("proveedorId")).toBeFalse();
    expect(p.has("estado")).toBeFalse();
    expect(p.has("desde")).toBeFalse();
  });

  it("detalle, pagar y generar", () => {
    svc.obtener(3).subscribe();
    const g = http.expectOne(`${base}/liquidaciones/3`);
    expect(g.request.method).toBe("GET");
    g.flush({});
    svc.pagar(3, "2026-10-20").subscribe();
    const p = http.expectOne(`${base}/liquidaciones/3/pagar`);
    expect(p.request.method).toBe("POST");
    expect(p.request.body).toEqual({ fechaPago: "2026-10-20" });
    p.flush({});
    svc.generar("2026-10-12", "2026-10-18").subscribe();
    const n = http.expectOne(`${base}/liquidaciones/generar`);
    expect(n.request.body).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" });
    n.flush({});
  });
});

describe("liquidaciones.util", () => {
  it("formatea CLP y fechas", () => {
    expect(clp(1234567).replace(/\s/g, "")).toBe("$1.234.567");
    expect(clp(null)).toBe("—");
    expect(fechaCorta("2026-10-12")).toBe("12-10-2026");
    expect(fechaCorta(null)).toBe("—");
  });
  it("semana anterior lunes a domingo", () => {
    expect(semanaAnteriorYmd(new Date(2026, 9, 20, 10))).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" }); // martes
    expect(semanaAnteriorYmd(new Date(2026, 9, 19, 10))).toEqual({ desde: "2026-10-12", hasta: "2026-10-18" }); // lunes
    expect(semanaAnteriorYmd(new Date(2026, 9, 18, 10))).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" }); // domingo
  });
  it("valida rango y fecha de pago", () => {
    expect(validarRango("", "2026-10-18")).toBeTruthy();
    expect(validarRango("2026-10-18", "2026-10-12")).toBeTruthy();
    expect(validarRango("2026-01-01", "2026-12-31")).toBeTruthy();
    expect(validarRango("2026-10-12", "2026-10-18")).toBeNull();
    expect(validarFechaPago("")).toBeTruthy();
    expect(validarFechaPago("2026-10-20")).toBeNull();
  });
  it("mensajes de error", () => {
    expect(mensajeErrorLiquidaciones({ status: 409, error: { error: { code: "LIQUIDACION_YA_PAGADA", message: "" } } })).toContain("ya estaba pagada");
    expect(mensajeErrorLiquidaciones({ status: 403 })).toContain("permiso");
  });
});
