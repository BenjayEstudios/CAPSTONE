import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { DashboardService } from "./dashboard.service";
import {
  claseVariacion, etiquetaMes, etiquetaSemana, geometriaGrafico, maximoEscala, mensajeErrorDashboard, mesLocalActual, textoVariacion
} from "./dashboard.util";

const base = environment.apiUrl;

describe("DashboardService", () => {
  let svc: DashboardService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("pide el resumen sin mes", () => {
    svc.resumen().subscribe();
    http.expectOne(`${base}/dashboard/resumen`).flush({});
  });
  it("pide el resumen con mes", () => {
    let mes = "";
    svc.resumen("2026-03").subscribe((r) => (mes = r.mes));
    http.expectOne(`${base}/dashboard/resumen?mes=2026-03`).flush({ mes: "2026-03" });
    expect(mes).toBe("2026-03");
  });
});

describe("dashboard.util", () => {
  it("formatea meses y semanas", () => {
    expect(etiquetaMes("2026-03")).toBe("marzo 2026");
    expect(etiquetaSemana({ inicio: "2026-03-02", fin: "2026-03-08", monto: 0 })).toBe("2 mar – 8 mar");
    expect(etiquetaSemana({ inicio: "2026-03-01", fin: "2026-03-01", monto: 0 })).toBe("1 mar");
  });
  it("variacion", () => {
    expect(textoVariacion(null)).toBe("Sin dato previo");
    expect(textoVariacion(12.5)).toBe("+12,5 %");
    expect(textoVariacion(-3)).toBe("-3 %");
    expect(textoVariacion(0)).toBe("0 %");
    expect(claseVariacion(5)).toBe("sube");
    expect(claseVariacion(-5)).toBe("baja");
    expect(claseVariacion(null)).toBe("igual");
  });
  it("escala maxima legible", () => {
    expect(maximoEscala(0)).toBe(1);
    expect(maximoEscala(100000)).toBe(100000);
    expect(maximoEscala(110000)).toBe(200000);
    expect(maximoEscala(430000)).toBe(500000);
    expect(maximoEscala(600000)).toBe(1000000);
  });
  it("geometria del grafico: alturas proporcionales y sin ventas", () => {
    const g = geometriaGrafico([
      { inicio: "2026-03-02", fin: "2026-03-08", monto: 100000 },
      { inicio: "2026-03-09", fin: "2026-03-15", monto: 50000 },
      { inicio: "2026-03-16", fin: "2026-03-22", monto: 0 }
    ]);
    expect(g.maximo).toBe(100000);
    expect(g.barras[0].alto).toBeCloseTo(g.barras[1].alto * 2, 5);
    expect(g.barras[2].alto).toBe(0);
    expect(g.barras[0].y + g.barras[0].alto).toBeCloseTo(g.base, 5);
    expect(g.ticks.length).toBe(5);
    expect(g.ticks[4].valor).toBe(100000);
  });
  it("geometria vacia no falla", () => {
    expect(geometriaGrafico([]).barras).toEqual([]);
    expect(geometriaGrafico([{ inicio: "a", fin: "a", monto: 0 }]).maximo).toBe(1);
  });
  it("mes local actual y mensajes de error", () => {
    expect(mesLocalActual(new Date(2026, 0, 5))).toBe("2026-01");
    expect(mensajeErrorDashboard({ status: 403 })).toContain("permiso");
    expect(mensajeErrorDashboard({ status: 0 })).toContain("conexión");
    expect(mensajeErrorDashboard({ error: { error: { message: "x" } } })).toBe("x");
  });
});
