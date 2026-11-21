import { provideHttpClient } from "@angular/common/http";
import { Type } from "@angular/core";
import { HttpTestingController, provideHttpClientTesting, TestRequest } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { PaginaCatalogo, ProductoCatalogo } from "../../core/models/catalogo.models";
import { plazo, precioPorUnidad } from "../../shared/formato";
import { BusquedaComponent } from "./busqueda.component";
import { CatalogoComponent } from "./catalogo.component";

const API = environment.apiUrl;
const producto = (over: Partial<ProductoCatalogo> = {}): ProductoCatalogo => ({
  id: 1, sku: "ACE-0001", nombre: "Aceite vegetal maravilla", marca: "Belmont", formato: "Bidón 5 L", contenido: 5, unidad: "L",
  categoriaId: 8, imagenUrl: null, precioDesde: 12490, precioHasta: 12890, ofertas: 2, plazoMinHoras: 24,
  proveedorMasBarato: { id: 2, nombre: "Los Andes Food Service" }, ...over
});
const pagina = (items: ProductoCatalogo[], over: Partial<PaginaCatalogo> = {}): PaginaCatalogo => ({
  items, total: items.length, pagina: 1, porPagina: 24, marcas: [{ marca: "Belmont", productos: 1 }], ...over
});

/** Params de la ultima llamada a /catalogo/productos. */
function params(req: TestRequest): Record<string, string> {
  const salida: Record<string, string> = {};
  new URL(req.request.urlWithParams, "http://x").searchParams.forEach((v, k) => (salida[k] = v));
  return salida;
}

async function montar<T>(componente: Type<T>, url: string) {
  TestBed.configureTestingModule({
    imports: [componente],
    providers: [provideRouter([{ path: "catalogo", component: CatalogoComponent }, { path: "buscar", component: BusquedaComponent }]), provideHttpClient(), provideHttpClientTesting()]
  });
  const ctrl = TestBed.inject(HttpTestingController);
  await TestBed.inject(Router).navigateByUrl(url);
  const f = TestBed.createComponent(componente);
  f.detectChanges();
  ctrl.match(`${API}/catalogo/resumen`).forEach((r) => r.flush({ proveedoresActivos: 3, productosComparados: 1, categorias: [{ id: 1, nombre: "Abarrotes", slug: "a", productos: 1, hijos: [{ id: 8, nombre: "Aceites", slug: "b", productos: 1, hijos: [] }] }] }));
  return { f, ctrl };
}

describe("formato del catalogo", () => {
  it("precio por kg/L y plazo", () => {
    expect(precioPorUnidad(12490, 5, "L")).toBe("$2.498/L");
    expect(precioPorUnidad(1000, null, "kg")).toBe("—");
    expect(plazo(24)).toBe("24 h");
    expect(plazo(120)).toBe("5 días");
  });
});

describe("Catalogo (KAN-90)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("por defecto ordena por precio mas bajo y pide 24 por pagina", async () => {
    const { f, ctrl } = await montar(CatalogoComponent, "/catalogo");
    const req = ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`));
    expect(params(req)).toEqual({ orden: "precio", pagina: "1", porPagina: "24" });
    req.flush(pagina([producto()]));
    await f.whenStable();
    f.detectChanges();
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Todo el catálogo");
    expect(texto).toContain("$12.490");
    expect(texto).toContain("$2.498/L · entrega desde 24 h");
    expect(texto).toContain("Comparar 2 distribuidores");
  });

  it("los filtros de la URL (categoria, plazo, minimo) llegan al API", async () => {
    const { ctrl } = await montar(CatalogoComponent, "/catalogo?categoria=8&plazo=48&minimo=1&orden=nombre");
    const req = ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`));
    expect(params(req)).toEqual({ categoriaId: "8", plazoMaxHoras: "48", maxMinimoCompra: "1", orden: "nombre", pagina: "1", porPagina: "24" });
    req.flush(pagina([]));
  });

  it("cambiar un filtro lo deja en la URL y vuelve a la pagina 1", async () => {
    const { f, ctrl } = await montar(CatalogoComponent, "/catalogo?pagina=3");
    ctrl.match((r) => r.url.startsWith(`${API}/catalogo/productos`)).forEach((r) => r.flush(pagina([])));
    const nav = spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    f.componentInstance.filtrar({ plazo: 24 });
    expect(nav).toHaveBeenCalledWith([], { queryParams: { plazo: 24, pagina: null }, queryParamsHandling: "merge" });
  });

  it("vista tabla: columnas de precio desde, por kg/L, entrega y distribuidores; se recuerda", async () => {
    const { f, ctrl } = await montar(CatalogoComponent, "/catalogo");
    ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`)).flush(pagina([producto()]));
    await f.whenStable();
    f.componentInstance.cambiarVista("lista");
    f.detectChanges();
    const fila = f.nativeElement.querySelector("tbody tr").textContent.replace(/\s+/g, " ");
    expect(fila).toContain("Aceite vegetal maravilla");
    expect(fila).toContain("$12.490");
    expect(fila).toContain("$2.498/L");
    expect(localStorage.getItem("cotizapp.catalogo.vista")).toBe("lista");
  });
});

describe("Busqueda (KAN-91)", () => {
  it("resultados con conteo, mas barato y diferencia con el mas caro; registra la busqueda una vez", async () => {
    const { f, ctrl } = await montar(BusquedaComponent, "/buscar?q=aceite");
    const req = ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`));
    expect(params(req)).toEqual({ q: "aceite", orden: "relevancia", pagina: "1", porPagina: "20" });
    req.flush(pagina([producto()]));
    await f.whenStable();
    f.detectChanges();
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Resultados para «aceite» 1 producto");
    expect(texto).toContain("desde Los Andes Food Service — el más caro publica $12.890");
    expect(texto).toContain("diferencia $400");

    const evento = ctrl.expectOne(`${API}/eventos/lote`);
    expect(evento.request.body.eventos[0]).toEqual(jasmine.objectContaining({ tipo_evento: "busqueda", termino: "aceite", resultados: 1 }));
    evento.flush(null, { status: 202, statusText: "Accepted" });
  });

  it("refinamientos de la URL llegan al API y no vuelven a registrar el termino", async () => {
    const { f, ctrl } = await montar(BusquedaComponent, "/buscar?q=aceite");
    ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`)).flush(pagina([producto()]));
    await f.whenStable();
    ctrl.expectOne(`${API}/eventos/lote`).flush(null, { status: 202, statusText: "x" });

    await TestBed.inject(Router).navigateByUrl("/buscar?q=aceite&plazo24=1&sinMinimo=1&retiro=1&marca=Belmont");
    f.detectChanges();
    const req = ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`));
    expect(params(req)).toEqual(jasmine.objectContaining({ plazoMaxHoras: "24", maxMinimoCompra: "1", conRetiro: "true", marca: "Belmont" }));
    req.flush(pagina([producto()]));
    await f.whenStable();
    ctrl.expectNone(`${API}/eventos/lote`);
  });

  it("sin resultados: lo dice, registra resultados = 0 y sugiere categorias", async () => {
    const { f, ctrl } = await montar(BusquedaComponent, "/buscar?q=salmon");
    ctrl.expectOne((r) => r.url.startsWith(`${API}/catalogo/productos`)).flush(pagina([], { marcas: [] }));
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("No encontramos «salmon»");
    expect(f.nativeElement.textContent).toContain("Abarrotes");
    const evento = ctrl.expectOne(`${API}/eventos/lote`);
    expect(evento.request.body.eventos[0]).toEqual(jasmine.objectContaining({ termino: "salmon", resultados: 0 }));
    evento.flush(null, { status: 202, statusText: "x" });
  });
});
