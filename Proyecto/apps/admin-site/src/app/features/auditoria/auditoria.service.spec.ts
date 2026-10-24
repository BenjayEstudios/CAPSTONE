import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { AuditoriaService, construirParams } from "./auditoria.service";
import { aplanar, calcularDiff } from "./auditoria.util";

const base = environment.apiUrl;

describe("AuditoriaService", () => {
  let svc: AuditoriaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(AuditoriaService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista con todos los filtros como query params", () => {
    svc.listar({ entidad: "proveedor", accion: "aprobar", usuarioId: "3", desde: "2026-01-01", hasta: "2026-01-31", pagina: 2, tamano: 20 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${base}/auditoria?`));
    const p = new URL(req.request.urlWithParams, "http://x").searchParams;
    const obtenido: Record<string, string | null> = {};
    for (const k of ["entidad", "accion", "usuarioId", "desde", "hasta", "pagina", "tamano"]) obtenido[k] = p.get(k);
    expect(obtenido).toEqual({
      entidad: "proveedor", accion: "aprobar", usuarioId: "3", desde: "2026-01-01", hasta: "2026-01-31", pagina: "2", tamano: "20"
    });
    req.flush({ items: [], pagina: 2, tamano: 20, total: 0, totalPaginas: 1 });
  });

  it("omite filtros vacios y aplica pagina/tamano por defecto", () => {
    expect(construirParams({ entidad: "", accion: " ", desde: "" }).toString()).toBe("pagina=1&tamano=20");
  });

  it("obtiene detalle y filtros", () => {
    svc.obtener(5).subscribe();
    http.expectOne(`${base}/auditoria/5`).flush({});
    svc.filtros().subscribe();
    http.expectOne(`${base}/auditoria/filtros`).flush({ acciones: [], entidades: [], usuarios: [] });
  });
});

describe("diff de auditoria", () => {
  it("aplana JSON anidado en rutas a.b", () => {
    expect(aplanar({ a: { b: 1, c: [10, { d: 2 }] }, e: null, f: {}, g: [] })).toEqual({
      "a.b": 1, "a.c.0": 10, "a.c.1.d": 2, e: null, f: {}, g: []
    });
  });

  it("detecta agregados, quitados, cambiados e iguales", () => {
    const r = calcularDiff({ estado: "en_revision", x: { y: 1 }, igual: true, viejo: 1 }, { estado: "activa", x: { y: 1 }, igual: true, nuevo: { z: 2 } });
    const por = Object.fromEntries(r.map((c) => [c.ruta, c.tipo]));
    expect(por).toEqual({ estado: "cambiado", "x.y": "igual", igual: "igual", viejo: "quitado", "nuevo.z": "agregado" });
    expect(r.find((c) => c.ruta === "estado")).toEqual({ ruta: "estado", tipo: "cambiado", antes: "en_revision", despues: "activa" });
  });

  it("maneja antes o despues nulos", () => {
    expect(calcularDiff(null, { a: 1 })).toEqual([{ ruta: "a", tipo: "agregado", despues: 1 }]);
    expect(calcularDiff({ a: 1 }, null)).toEqual([{ ruta: "a", tipo: "quitado", antes: 1 }]);
    expect(calcularDiff(null, null)).toEqual([]);
  });

  it("distingue null de ausente", () => {
    expect(calcularDiff({ a: null }, { a: 1 })[0].tipo).toBe("cambiado");
  });
});
