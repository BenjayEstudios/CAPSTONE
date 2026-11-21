import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { ResultadoImportacion } from "../../core/models/catalogo.models";
import { CatalogoImportarComponent, mensajeErrorImportacion } from "./catalogo-importar.component";

const simulacion = (crear: number, errores = 0): ResultadoImportacion => ({
  simulacion: true,
  totalFilas: crear + errores,
  resumen: { crear, actualizar: 0, sinCambios: 0, errores },
  filas: [
    ...Array.from({ length: crear }, (_, i) => ({ fila: i + 2, sku: `S-${i}`, accion: "crear" as const })),
    ...Array.from({ length: errores }, (_, i) => ({
      fila: crear + i + 2, sku: null, accion: "error" as const, error: { codigo: "VALIDACION", mensaje: "sku: falta el SKU" }
    }))
  ]
});

describe("CatalogoImportarComponent", () => {
  let http: HttpTestingController;
  let cmp: CatalogoImportarComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    cmp = TestBed.createComponent(CatalogoImportarComponent).componentInstance;
  });
  afterEach(() => http.verify());

  const conArchivo = () => cmp.archivo.set(new File(["x"], "p.xlsx"));

  it("no se puede importar sin validar antes", () => {
    conArchivo();
    expect(cmp.puedeImportar()).toBeFalse();
    cmp.importar();
    http.expectNone(`${environment.apiUrl}/productos/importar?simular=false`);
  });

  it("valida (simular=true) y luego importa (simular=false)", () => {
    conArchivo();
    cmp.validar();
    http.expectOne(`${environment.apiUrl}/productos/importar?simular=true`).flush(simulacion(2, 1));
    expect(cmp.puedeImportar()).toBeTrue();
    expect(cmp.filasVisibles().length).toBe(3);
    cmp.soloErrores.set(true);
    expect(cmp.filasVisibles().length).toBe(1);

    cmp.importar();
    http.expectOne(`${environment.apiUrl}/productos/importar?simular=false`).flush({ ...simulacion(2, 1), simulacion: false });
    expect(cmp.resultado()?.simulacion).toBeFalse();
    expect(cmp.puedeImportar()).toBeFalse();
  });

  it("si todo son errores no hay nada que importar", () => {
    conArchivo();
    cmp.validar();
    http.expectOne(`${environment.apiUrl}/productos/importar?simular=true`).flush(simulacion(0, 2));
    expect(cmp.puedeImportar()).toBeFalse();
  });

  it("muestra el mensaje del API cuando falla", () => {
    conArchivo();
    cmp.validar();
    http
      .expectOne(`${environment.apiUrl}/productos/importar?simular=true`)
      .flush({ error: { code: "PLANTILLA_INVALIDA", message: "No se encontro la columna SKU" } }, { status: 400, statusText: "Bad Request" });
    expect(cmp.error()).toBe("No se encontro la columna SKU");
    expect(cmp.trabajando()).toBeNull();
  });

  it("rechaza archivos que no son .xlsx", () => {
    const input = { files: [new File(["a,b"], "datos.csv")], value: "x" } as unknown as HTMLInputElement;
    cmp.onArchivo(input);
    expect(cmp.archivo()).toBeNull();
    expect(cmp.error()).toContain(".xlsx");
  });
});

describe("mensajeErrorImportacion", () => {
  it("traduce 413 y 403 y cae a un mensaje generico", () => {
    expect(mensajeErrorImportacion({ status: 413 })).toContain("tamaño");
    expect(mensajeErrorImportacion({ status: 403 })).toContain("permiso");
    expect(mensajeErrorImportacion({ status: 0 })).toContain("No se pudo procesar");
  });
});
