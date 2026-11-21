import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { FichaProducto, OfertaFicha } from "../../core/models/catalogo.models";
import { ItemCarro } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { usuarioDePrueba } from "../../core/testing/usuario-de-prueba";
import { armarCarro } from "./carro.calculo";
import { CarroComponent } from "./carro.component";

const API = environment.apiUrl;

const proveedor = (id: number, nombre: string, costoDespacho: number | null, despachoGratisDesde: number | null) => ({
  id, nombre, entregasATiempoPct: 95, despachoGratisDesde, costoDespacho, zona: null, calificacion: { promedio: null, cantidad: 0 }
});
const LOS_ANDES = proveedor(2, "Los Andes Food Service", 4990, 150000);
const VALLE = proveedor(3, "Valle Central Mayorista", 5990, 200000);
const oferta = (id: number, precio: number, prov: OfertaFicha["proveedor"], over: Partial<OfertaFicha> = {}): OfertaFicha => ({
  id, precioUnitario: precio, precioNormalizado: null, unidadesPorCaja: 12, cajasDisponibles: 20, minimoCompra: 1, plazoHoras: 24,
  modalidadEntrega: "ambos", notasCliente: null, proveedor: prov, ...over
});
const ficha = (id: number, nombre: string, ofertas: OfertaFicha[]): FichaProducto => ({
  id, sku: `SKU-${id}`, nombre, marca: null, formato: "Caja 1 L", contenido: 1, unidad: "L", categoriaId: 11, imagenUrl: null,
  descripcion: null, precioReferencia: null, categoria: { id: 11, nombre: "Leches", padre: null }, ofertas
});

// Leche: Los Andes $1.090 (24 h) y Valle $1.150 (48 h). Aceite: Los Andes $9.490, minimo 24 un. en cajas de 12.
const LECHE = ficha(9, "Leche entera", [oferta(17, 1090, LOS_ANDES), oferta(18, 1150, VALLE, { plazoHoras: 48 })]);
const ACEITE = ficha(1, "Aceite de oliva", [oferta(1, 9490, LOS_ANDES, { minimoCompra: 24 }), oferta(2, 9990, VALLE)]);
const FICHAS = new Map([[9, LECHE], [1, ACEITE]]);

const item = (ofertaId: number, productoId: number, proveedorId: number, cantidad: number, precio: number, over: Partial<ItemCarro> = {}): ItemCarro => ({
  ofertaId, cantidad, precioVisto: precio, precioActual: precio, productoId, nombreProducto: productoId === 9 ? "Leche entera" : "Aceite de oliva",
  formato: "Caja 1 L", proveedorId, disponible: true, cajasDisponibles: 20, ...over
});

describe("armarCarro (KAN-94)", () => {
  it("agrupa por distribuidor con plazo, subtotal y despacho; resume productos, despachos, ahorro y total", () => {
    const r = armarCarro([item(17, 9, 2, 10, 1090), item(1, 1, 2, 2, 9490), item(18, 9, 3, 4, 1150)], FICHAS);
    expect(r.grupos.map((g) => g.nombre)).toEqual(["Los Andes Food Service", "Valle Central Mayorista"]);
    const [andes, valle] = r.grupos;
    expect(andes!.subtotal).toBe(10 * 1090 + 2 * 9490);
    expect(andes!.plazoHoras).toBe(24);
    expect(andes!.despacho).toEqual({ tipo: "despacho", costo: 4990, gratisDesde: 150000 });
    expect(andes!.nota).toBe("Despacho de Los Andes Food Service: $4.990 · gratis sobre $150.000");
    expect(valle!.plazoHoras).toBe(48);
    expect(r.despachos).toBe(4990 + 5990);
    // Ahorro frente al mas caro: leche Andes 10 x (1150-1090), aceite 2 x (9990-9490); Valle ya es el mas caro.
    expect(r.ahorro).toBe(10 * 60 + 2 * 500);
    expect(r.total).toBe(r.subtotal + r.despachos);
    expect(r.bloqueos).toEqual([]);
  });

  it("despacho gratis sobre el umbral; retiro sin costo; sin cobertura avisa", () => {
    const gratis = armarCarro([item(17, 9, 2, 150, 1090)], FICHAS);
    expect(gratis.grupos[0]!.despacho.tipo).toBe("gratis");
    expect(gratis.despachos).toBe(0);

    const soloRetiro = new Map([[9, ficha(9, "Leche entera", [oferta(17, 1090, LOS_ANDES, { modalidadEntrega: "retiro" })])]]);
    expect(armarCarro([item(17, 9, 2, 1, 1090)], soloRetiro).grupos[0]!.despacho.tipo).toBe("retiro");

    const sinCobertura = new Map([[9, ficha(9, "Leche entera", [oferta(17, 1090, proveedor(2, "Los Andes Food Service", null, 150000))])]]);
    expect(armarCarro([item(17, 9, 2, 1, 1090)], sinCobertura).grupos[0]!.nota).toContain("no despacha a tu comuna");
  });

  it("marca precio cambiado, falta de stock, bajo el minimo y no disponibles, y bloquea el pago", () => {
    const r = armarCarro(
      [
        item(17, 9, 2, 24, 1090, { precioActual: 1120 }),
        item(1, 1, 2, 1, 9490),
        item(99, 5, 4, 3, 2000, { disponible: false, precioActual: null })
      ],
      FICHAS
    );
    const [leche, aceite] = r.lineas;
    expect(leche!.precioCambio).toBeTrue();
    expect(leche!.sinStock).toBeTrue(); // 24 cajas y quedan 20 (el caso del seed)
    expect(leche!.subtotal).toBe(24 * 1120); // a precio de hoy, como el checkout
    expect(aceite!.minCajas).toBe(2); // 24 un. / 12 por caja
    expect(aceite!.bajoMinimo).toBeTrue();
    expect(r.noDisponibles.map((l) => l.ofertaId)).toEqual([99]);
    expect(r.grupos).toHaveSize(1); // lo no disponible no forma grupo ni suma despacho
    expect(r.bloqueos).toHaveSize(4);
  });
});

describe("Pantalla del carro (KAN-94)", () => {
  let ctrl: HttpTestingController;

  async function abrir(items: ItemCarro[]) {
    TestBed.configureTestingModule({
      imports: [CarroComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    const f = TestBed.createComponent(CarroComponent);
    f.detectChanges();
    ctrl.match(`${API}/carro`).forEach((r) => r.flush({ id: 1, estado: "abierto", items }));
    await f.whenStable();
    f.detectChanges();
    for (const id of new Set(items.map((i) => i.productoId))) {
      ctrl.match(`${API}/catalogo/productos/${id}`).forEach((r) => r.flush(FICHAS.get(id!) ?? null));
    }
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  function put(f: { detectChanges(): void }, items: ItemCarro[]) {
    const req = ctrl.expectOne((r) => r.method === "PUT" && r.url === `${API}/carro`);
    const body = req.request.body;
    req.flush({ id: 1, estado: "abierto", items });
    f.detectChanges();
    return body;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("vacio: invita a ir al catalogo", async () => {
    const f = await abrir([]);
    expect(f.nativeElement.textContent).toContain("Todavía no agregas nada");
    expect(f.nativeElement.querySelector("a[href='/catalogo']")).not.toBeNull();
  });

  it("muestra los grupos con plazo y subtotal, y el resumen con despachos, ahorro y total", async () => {
    const f = await abrir([item(17, 9, 2, 10, 1090), item(18, 9, 3, 4, 1150)]);
    const grupos = [...f.nativeElement.querySelectorAll(".grupo")] as HTMLElement[];
    expect(grupos).toHaveSize(2);
    expect(grupos[0]!.textContent).toContain("Los Andes Food Service");
    expect(grupos[0]!.textContent).toContain("Entrega 24 h");
    expect(grupos[0]!.textContent).toContain("Subtotal $10.900");
    expect(grupos[1]!.textContent).toContain("Entrega 48 h");
    const resumen = f.nativeElement.querySelector(".resumen").textContent.replace(/\s+/g, "");
    expect(resumen).toContain("Despachos(2)$10.980");
    expect(resumen).toContain("Ahorrovs.compraralmáscaro$600");
    expect(resumen).toContain("Total$26.480"); // 10.900 + 4.600 + 10.980
    expect(f.nativeElement.querySelector(".continuar").disabled).toBeFalse();
  });

  it("+ y – cambian la cantidad con PUT /carro; el – no baja del minimo", async () => {
    const f = await abrir([item(17, 9, 2, 2, 1090), item(1, 1, 2, 2, 9490)]);
    const lineas = [...f.nativeElement.querySelectorAll(".grupo .linea")] as HTMLElement[];
    const [menosLeche, masLeche] = Array.from(lineas[0]!.querySelectorAll<HTMLButtonElement>(".cantidad button"));
    const [menosAceite] = Array.from(lineas[1]!.querySelectorAll<HTMLButtonElement>(".cantidad button"));
    expect(menosAceite!.disabled).toBeTrue(); // aceite: minimo 24 un. = 2 cajas

    masLeche!.click();
    expect(put(f, [item(17, 9, 2, 3, 1090), item(1, 1, 2, 2, 9490)])).toEqual({
      items: [{ ofertaId: 17, cantidad: 3, precioVisto: 1090 }, { ofertaId: 1, cantidad: 2, precioVisto: 9490 }]
    });
    await f.whenStable();
    f.detectChanges();
    menosLeche!.click();
    expect(put(f, [item(17, 9, 2, 2, 1090), item(1, 1, 2, 2, 9490)]).items[0]).toEqual({ ofertaId: 17, cantidad: 2, precioVisto: 1090 });
  });

  it("× quita la linea", async () => {
    const f = await abrir([item(17, 9, 2, 2, 1090), item(18, 9, 3, 4, 1150)]);
    (f.nativeElement.querySelector(".grupo .quitar") as HTMLButtonElement).click();
    expect(put(f, [item(18, 9, 3, 4, 1150)])).toEqual({ items: [{ ofertaId: 18, cantidad: 4, precioVisto: 1150 }] });
  });

  it("avisa si un precio cambio desde que se agrego y no deja pagar hasta aceptarlo", async () => {
    const f = await abrir([item(17, 9, 2, 2, 1090, { precioActual: 1120 })]);
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Algunos precios cambiaron desde que los agregaste");
    expect(texto).toContain("Leche entera: $1.090 → $1.120");
    expect(f.nativeElement.querySelector(".continuar").disabled).toBeTrue();
    const aceptar = [...f.nativeElement.querySelectorAll("button")].find((b: HTMLButtonElement) => b.textContent?.includes("Aceptar los precios")) as HTMLButtonElement;
    aceptar.click();
    expect(put(f, [item(17, 9, 2, 2, 1120)])).toEqual({ items: [{ ofertaId: 17, cantidad: 2, precioVisto: 1120 }] });
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector(".continuar").disabled).toBeFalse();
  });

  it("stock insuficiente: 'Ajustar a N'; Continuar al pago lleva a /checkout cuando no hay bloqueos", async () => {
    const f = await abrir([item(17, 9, 2, 24, 1090)]);
    expect(f.nativeElement.textContent).toContain("Solo quedan 20 cajas");
    const ajustar = [...f.nativeElement.querySelectorAll(".alerta button")][0] as HTMLButtonElement;
    ajustar.click();
    expect(put(f, [item(17, 9, 2, 20, 1090)]).items[0].cantidad).toBe(20);
    await f.whenStable();
    f.detectChanges();
    const nav = spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    (f.nativeElement.querySelector(".continuar") as HTMLButtonElement).click();
    expect(nav).toHaveBeenCalledWith(["/checkout"]);
  });
});
