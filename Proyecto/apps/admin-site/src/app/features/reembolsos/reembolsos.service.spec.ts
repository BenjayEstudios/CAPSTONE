import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { ReembolsosService } from "./reembolsos.service";
import { mensajeErrorReembolsos, validarReembolso } from "./reembolsos.util";

const base = environment.apiUrl;

describe("ReembolsosService", () => {
  let svc: ReembolsosService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(ReembolsosService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("busca por codigo con encoding", () => {
    svc.buscar(" CM-1 2").subscribe();
    http.expectOne(`${base}/reembolsos/buscar?codigo=CM-1%202`).flush({});
  });
  it("crea el reembolso con POST", () => {
    svc.crear(5, { monto: 100, motivo: "x" }).subscribe();
    const req = http.expectOne(`${base}/ordenes/5/reembolsos`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ monto: 100, motivo: "x" });
    req.flush({});
  });
  it("descarga el pdf como blob", () => {
    svc.pdf("/documentos-tributarios/3/pdf").subscribe();
    const req = http.expectOne(`${base}/documentos-tributarios/3/pdf`);
    expect(req.request.responseType).toBe("blob");
    req.flush(new Blob(["%PDF"]));
  });
});

describe("reembolsos.util", () => {
  it("total usa el saldo y exige motivo", () => {
    expect(validarReembolso("total", "", "motivo", 5000)).toEqual({ monto: 5000, errorMotivo: undefined });
    expect(validarReembolso("total", "", "  ", 5000).errorMotivo).toBeTruthy();
    expect(validarReembolso("total", "", "x".repeat(301), 5000).errorMotivo).toBeTruthy();
  });
  it("parcial valida entero, rango y saldo", () => {
    expect(validarReembolso("parcial", "1.500", "m", 5000).monto).toBe(1500);
    expect(validarReembolso("parcial", "abc", "m", 5000).error).toBeTruthy();
    expect(validarReembolso("parcial", "0", "m", 5000).error).toBeTruthy();
    expect(validarReembolso("parcial", "5001", "m", 5000).error).toContain("excede");
    expect(validarReembolso("parcial", "12,5", "m", 5000).error).toBeTruthy();
  });
  it("mapea errores del servidor", () => {
    expect(mensajeErrorReembolsos({ status: 409, error: { error: { code: "MONTO_EXCEDE_SALDO", message: "excede $10" } } })).toBe("excede $10");
    expect(mensajeErrorReembolsos({ status: 409, error: { error: { code: "ORDEN_NO_PAGADA" } } })).toContain("no está pagada");
    expect(mensajeErrorReembolsos({ status: 403 })).toContain("permiso");
    expect(mensajeErrorReembolsos({ status: 0 })).toContain("conexión");
  });
});
