import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { environment } from "../../../environments/environment";
import { FichaProducto, OfertaFicha } from "../../core/models/catalogo.models";
import { CarroState } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { usuarioDePrueba } from "../../core/testing/usuario-de-prueba";
import { cajasMinimas, ProductoComponent } from "./producto.component";

const API = environment.apiUrl;
const oferta = (id: number, precio: number, nombre: string, over: Partial<OfertaFicha> = {}): OfertaFicha => ({
  id, precioUnitario: precio, precioNormalizado: { valor: precio, por: "L" }, unidadesPorCaja: 12, cajasDisponibles: 50, minimoCompra: 1,
  plazoHoras: 24, modalidadEntrega: "ambos", notasCliente: null,
  proveedor: { id: id + 100, nombre, entregasATiempoPct: 95, despachoGratisDesde: 150000, costoDespacho: 4990,
    zona: { comuna: "Quilicura", region: "Metropolitana de Santiago" }, calificacion: { promedio: 4.67, cantidad: 6 } },
  ...over
});
const FICHA: FichaProducto = {
  id: 9, sku: "LEC-0001", nombre: "Leche entera", marca: "Colún", formato: "Caja 1 L", contenido: 1, unidad: "L", categoriaId: 11,
  imagenUrl: null, descripcion: null, precioReferencia: 1190,
  categoria: { id: 11, nombre: "Leches y cremas", padre: { id: 2, nombre: "Lácteos y huevos" } },
  ofertas: [oferta(18, 1090, "Los Andes Food Service"), oferta(19, 1120, "FrigoSur"), oferta(20, 1150, "Valle Central Mayorista"), oferta(21, 1290, "Otro")]
};

describe("Ficha de producto (KAN-92, KAN-93)", () => {
  let ctrl: HttpTestingController;

  async function abrir(url = "/producto/9?origen=catalogo", ficha: FichaProducto | null = FICHA) {
    TestBed.configureTestingModule({
      imports: [ProductoComponent],
      providers: [provideRouter([{ path: "producto/:id", component: ProductoComponent }]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    // El harness monta el componente dentro del router-outlet, asi recibe el :id de la ruta.
    const h = await RouterTestingHarness.create();
    const componentInstance = await h.navigateByUrl(url, ProductoComponent);
    const req = ctrl.expectOne(`${API}/catalogo/productos/9`);
    if (ficha) req.flush(ficha);
    else req.flush({ error: { code: "PRODUCTO_NO_ENCONTRADO" } }, { status: 404, statusText: "x" });
    await h.fixture.whenStable();
    h.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { componentInstance, nativeElement: h.routeNativeElement as any };
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("muestra formato, SKU, precio mas bajo hoy y la diferencia; registra vista_producto con su origen", async () => {
    const f = await abrir();
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Caja 1 L · Colún · SKU LEC-0001");
    expect(f.nativeElement.querySelector(".tinta-desfasada").textContent.trim()).toBe("$1.090");
    expect(texto).toContain("4 distribuidores publican este producto");
    expect(texto).toContain("$200 entre el más barato y el más caro");
    const ev = ctrl.expectOne(`${API}/eventos/lote`);
    expect(ev.request.body.eventos[0]).toEqual(jasmine.objectContaining({ tipo_evento: "vista_producto", producto_id: 9, origen: "catalogo" }));
    ev.flush(null, { status: 202, statusText: "x" });
  });

  it("tabla: todos los distribuidores con precio, por L, plazo, minimo, zona y 'Mas bajo' en el primero", async () => {
    const f = await abrir();
    const filas = [...f.nativeElement.querySelectorAll("tbody tr")] as HTMLElement[];
    expect(filas).toHaveSize(4);
    const primera = filas[0]!.textContent!.replace(/\s+/g, " ");
    expect(primera).toContain("Los Andes Food Service");
    expect(primera).toContain("Quilicura · Metropolitana de Santiago");
    expect(primera).toContain("$1.090/L");
    expect(primera).toContain("1 un.");
    expect(primera).toContain("Más bajo");
    expect(filas[1]!.textContent).not.toContain("Más bajo");
  });

  it("lado a lado: los 3 mas baratos con su diferencia, 'Comprar a <distribuidor>' y 'Ver los N en tabla'", async () => {
    const f = await abrir("/producto/9?vista=lado");
    const texto = f.nativeElement.querySelector(".lado-a-lado").textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Los Andes Food Service");
    expect(texto).toContain("Valle Central Mayorista");
    expect(texto).not.toContain("Otro");
    expect(texto).toContain("+$30");
    expect(texto).toContain("+$60");
    const botones = [...f.nativeElement.querySelectorAll(".lado-a-lado .btn-comprar")].map((b: HTMLElement) => b.textContent?.trim());
    expect(botones).toEqual(["Comprar a Los Andes Food Service", "Comprar a FrigoSur", "Comprar a Valle Central Mayorista"]);
    expect(f.nativeElement.textContent).toContain("Ver los 4 en tabla");
  });

  it("Comprar sin sesion registra click_oferta y lleva a ingresar volviendo a la ficha", async () => {
    const f = await abrir("/producto/9");
    ctrl.match(`${API}/eventos/lote`).forEach((r) => r.flush(null, { status: 202, statusText: "x" }));
    const nav = spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    await f.componentInstance.comprar(FICHA.ofertas[1]!);
    const ev = ctrl.expectOne(`${API}/eventos/lote`);
    expect(ev.request.body.eventos[0]).toEqual(jasmine.objectContaining({ tipo_evento: "click_oferta", producto_id: 9, oferta_id: 19, convirtio: false }));
    ev.flush(null, { status: 202, statusText: "x" });
    expect(nav).toHaveBeenCalledWith(["/ingresar"], { queryParams: { returnUrl: jasmine.any(String) } });
  });

  it("Comprar como comprador suma la oferta al carro actual (PUT /carro) y lo confirma", async () => {
    TestBed.resetTestingModule();
    const f = await abrir("/producto/9");
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    ctrl.match(`${API}/carro`).forEach((r) => r.flush({ id: 1, estado: "abierto", items: [] }));
    TestBed.inject(CarroState).items.set([
      { ofertaId: 5, cantidad: 2, precioVisto: 3000, precioActual: 3000, productoId: 3, nombreProducto: "Arroz", formato: null, proveedorId: 2, disponible: true, cajasDisponibles: 9 }
    ]);
    ctrl.match(`${API}/eventos/lote`).forEach((r) => r.flush(null, { status: 202, statusText: "x" }));

    const p = f.componentInstance.comprar(FICHA.ofertas[0]!);
    ctrl.match(`${API}/eventos/lote`).forEach((r) => r.flush(null, { status: 202, statusText: "x" }));
    const put = ctrl.expectOne((r) => r.method === "PUT" && r.url === `${API}/carro`);
    expect(put.request.body).toEqual({ items: [{ ofertaId: 5, cantidad: 2, precioVisto: 3000 }, { ofertaId: 18, cantidad: 1, precioVisto: 1090 }] });
    put.flush({ id: 1, estado: "abierto", items: [] });
    await p;
    expect(f.componentInstance.aviso()?.texto).toContain("Agregaste 1 caja de Leche entera de Los Andes Food Service");
  });

  it("un proveedor no puede comprar; un producto que no esta da 404 amable", async () => {
    TestBed.resetTestingModule();
    const f = await abrir("/producto/9");
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba({ organizacion: { id: 2, nombre: "Los Andes", tipo: "proveedor" } }));
    await f.componentInstance.comprar(FICHA.ofertas[0]!);
    expect(f.componentInstance.aviso()?.texto).toContain("cuenta de comprador");

    TestBed.resetTestingModule();
    const g = await abrir("/producto/9", null);
    expect(g.nativeElement.textContent).toContain("Este producto no está en el catálogo");
  });

  it("cajasMinimas: cumple el minimo (en unidades) con cajas enteras", () => {
    expect(cajasMinimas({ minimoCompra: null, unidadesPorCaja: 12 })).toBe(1);
    expect(cajasMinimas({ minimoCompra: 12, unidadesPorCaja: 12 })).toBe(1);
    expect(cajasMinimas({ minimoCompra: 24, unidadesPorCaja: 10 })).toBe(3);
    expect(cajasMinimas({ minimoCompra: 5, unidadesPorCaja: null })).toBe(5);
  });
});
