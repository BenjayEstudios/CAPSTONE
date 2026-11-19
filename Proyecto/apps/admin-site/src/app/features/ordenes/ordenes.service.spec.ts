import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { EnvioOrden } from "../../core/models/ordenes.models";
import { OrdenesService, construirParams } from "./ordenes.service";
import { formatoClp, formatoPct, formatoPlazo, medioPagoEtiqueta, mensajeErrorOrdenes, totalesEnvios } from "./ordenes.util";

const base = environment.apiUrl;
const envio = (extra: Partial<EnvioOrden>): EnvioOrden => ({
  id: 1, proveedorId: 1, proveedorNombre: "P", modalidad: "despacho", plazoHoras: 48, costoDespacho: 1000, subtotal: 5000,
  comisionPct: "10.00", comisionMonto: 500, montoEnvio: 6000, montoALiquidar: 5500, estado: "por_despachar", ...extra
});

describe("OrdenesService", () => {
  let svc: OrdenesService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(OrdenesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista con estado, pagina y tamano", () => {
    svc.listar({ estado: "pagada", pagina: 3 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/ordenes?`));
    const u = new URL(req.request.urlWithParams, "http://x");
    expect(u.searchParams.get("estado")).toBe("pagada");
    expect(u.searchParams.get("pagina")).toBe("3");
    expect(u.searchParams.get("tamano")).toBe("20");
    req.flush({ items: [], pagina: 3, tamano: 20, total: 0, totalPaginas: 1 });
  });

  it("omite estado vacio", () => {
    expect(construirParams({ estado: "" }).has("estado")).toBeFalse();
  });

  it("obtiene el detalle", () => {
    let codigo = "";
    svc.obtener(7).subscribe((d) => (codigo = d.codigo));
    http.expectOne(`${base}/ordenes/7`).flush({ codigo: "CM-1" });
    expect(codigo).toBe("CM-1");
  });
});

describe("ordenes.util", () => {
  it("formatea CLP", () => {
    expect(formatoClp(1234567)).toContain("1.234.567");
    expect(formatoClp(null)).toBe("—");
  });
  it("formatea plazo, porcentaje y medio de pago", () => {
    expect(formatoPlazo(12)).toBe("12 h");
    expect(formatoPlazo(24)).toBe("1 día");
    expect(formatoPlazo(54)).toBe("2 días 6 h");
    expect(formatoPlazo(null)).toBe("—");
    expect(formatoPct("10.00")).toBe("10 %");
    expect(formatoPct(null)).toBe("—");
    expect(medioPagoEtiqueta("linea_credito")).toBe("Línea de crédito");
    expect(medioPagoEtiqueta(null)).toBe("—");
  });
  it("totaliza comision y neto sin envios cancelados", () => {
    const t = totalesEnvios([envio({}), envio({ id: 2, estado: "cancelado" }), envio({ id: 3, comisionMonto: 100, montoALiquidar: 900 })]);
    expect(t).toEqual({ comision: 600, aLiquidar: 6400 });
  });
  it("mapea errores", () => {
    expect(mensajeErrorOrdenes({ status: 403 })).toContain("permiso");
    expect(mensajeErrorOrdenes({ status: 0 })).toContain("conexión");
  });
});
