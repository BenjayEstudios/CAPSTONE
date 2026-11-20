import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { ResumenCatalogo } from "../../core/models/catalogo.models";
import { CarroState } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { usuarioDePrueba } from "../../core/testing/usuario-de-prueba";
import { contador, InicioComponent } from "./inicio.component";

const url = (p: string) => `${environment.apiUrl}${p}`;
const RESUMEN: ResumenCatalogo = {
  proveedoresActivos: 3,
  productosComparados: 17,
  categorias: [
    { id: 1, nombre: "Abarrotes", slug: "abarrotes", productos: 4, hijos: [
      { id: 8, nombre: "Aceites", slug: "aceites", productos: 2, hijos: [] },
      { id: 12, nombre: "Vacia", slug: "vacia", productos: 0, hijos: [] }
    ] },
    { id: 7, nombre: "Sin productos", slug: "sin", productos: 0, hijos: [] }
  ]
};
const DIFERENCIAS = {
  items: [{ id: 21, sku: "HAR-1", nombre: "Harina sin polvos de hornear", marca: null, formato: "Saco 25 kg", contenido: 25, unidad: "kg", categoriaId: 13, imagenUrl: null, precioDesde: 20990, precioHasta: 22490, ofertas: 2, plazoMinHoras: 24 }],
  total: 1, pagina: 1, porPagina: 5
};

describe("Inicio (KAN-89)", () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [InicioComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  async function cargar() {
    const f = TestBed.createComponent(InicioComponent);
    f.detectChanges();
    ctrl.expectOne(url("/catalogo/resumen")).flush(RESUMEN);
    ctrl.expectOne(url("/catalogo/productos?orden=diferencia&porPagina=5")).flush(DIFERENCIAS);
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  it("contadores con datos reales y el efecto de tinta desfasada", async () => {
    const f = await cargar();
    const nums = [...f.nativeElement.querySelectorAll(".tinta-desfasada")].map((e: HTMLElement) => [e.textContent?.trim(), e.dataset["valor"]]);
    expect(nums).toEqual([["3", "3"], ["17", "17"]]);
  });

  it("categorias de nivel 1 y 2 con su conteo, sin las vacias", async () => {
    const texto = (await cargar()).nativeElement.querySelector(".lateral").textContent.replace(/\s+/g, " ");
    expect(texto).toMatch(/Abarrotes\s*4/);
    expect(texto).toMatch(/Aceites\s*2/);
    expect(texto).not.toContain("Vacia");
    expect(texto).not.toContain("Sin productos");
  });

  it("mayor diferencia de precio: monto, rango y enlace a la ficha", async () => {
    const f = await cargar();
    const li: HTMLElement = f.nativeElement.querySelector(".diferencias li");
    expect(li.querySelector(".monto")?.textContent).toContain("$1.500");
    expect(li.textContent).toContain("$20.990 a $22.490");
    expect(li.querySelector("a")?.getAttribute("href")).toBe("/producto/21");
  });

  it("el ejemplo busca en el catalogo", async () => {
    const f = await cargar();
    const nav = spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    f.componentInstance.buscarEjemplo();
    expect(nav).toHaveBeenCalledWith(["/catalogo"], { queryParams: { q: "arroz" } });
  });

  it("si falla la mayor diferencia ofrece reintentar", async () => {
    const f = TestBed.createComponent(InicioComponent);
    f.detectChanges();
    ctrl.expectOne(url("/catalogo/resumen")).flush(RESUMEN);
    ctrl.expectOne(url("/catalogo/productos?orden=diferencia&porPagina=5")).flush({}, { status: 500, statusText: "x" });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("No pudimos cargar las diferencias");
  });

  it("contador: miles con punto y desde 10.000 en 'mil'", () => {
    expect(contador(1248)).toBe("1.248");
    expect(contador(34000)).toBe("34 mil");
    expect(contador(17)).toBe("17");
  });
});

describe("CarroState", () => {
  let ctrl: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  it("para un comprador carga /carro y calcula productos, total y proveedores", async () => {
    const carro = TestBed.inject(CarroState);
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    TestBed.flushEffects();
    ctrl.expectOne(url("/carro")).flush({
      id: 1, estado: "abierto",
      items: [
        { ofertaId: 1, cantidad: 24, precioActual: 1090, precioVisto: 1090, productoId: 9, nombreProducto: "Leche", formato: null, proveedorId: 2, disponible: true, cajasDisponibles: 20 },
        { ofertaId: 2, cantidad: 3, precioActual: 10490, precioVisto: 10490, productoId: 5, nombreProducto: "Queso", formato: null, proveedorId: 4, disponible: true, cajasDisponibles: 9 },
        { ofertaId: 3, cantidad: 10, precioActual: 1390, precioVisto: 1390, productoId: 15, nombreProducto: "Tomate", formato: null, proveedorId: 3, disponible: true, cajasDisponibles: 40 }
      ]
    });
    await Promise.resolve();
    expect(carro.productos()).toBe(3);
    expect(carro.total()).toBe(71530);
    expect(carro.proveedores()).toBe(3);
  });

  it("sin sesion o con sesion de proveedor no pide el carro", () => {
    const carro = TestBed.inject(CarroState);
    TestBed.flushEffects();
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba({ organizacion: { id: 2, nombre: "Los Andes", tipo: "proveedor" } }));
    TestBed.flushEffects();
    ctrl.expectNone(url("/carro"));
    expect(carro.total()).toBe(0);
  });
});
