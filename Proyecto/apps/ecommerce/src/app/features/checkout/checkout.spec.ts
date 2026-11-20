import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { environment } from "../../../environments/environment";
import { NavegadorPasarela } from "../../core/checkout/checkout.service";
import { FichaProducto, OfertaFicha } from "../../core/models/catalogo.models";
import { OpcionesEntrega, OrdenDetalle } from "../../core/models/checkout.models";
import { ItemCarro } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { usuarioDePrueba } from "../../core/testing/usuario-de-prueba";
import { CheckoutComponent } from "./checkout.component";
import { ResultadoPagoComponent } from "./resultado.component";

const API = environment.apiUrl;
const prov = (id: number, nombre: string, costo: number) => ({
  id, nombre, entregasATiempoPct: 95, despachoGratisDesde: 150000, costoDespacho: costo, zona: null, calificacion: { promedio: null, cantidad: 0 }
});
const oferta = (id: number, precio: number, p: OfertaFicha["proveedor"], modalidadEntrega: OfertaFicha["modalidadEntrega"] = "ambos"): OfertaFicha => ({
  id, precioUnitario: precio, precioNormalizado: null, unidadesPorCaja: 12, cajasDisponibles: 50, minimoCompra: 1, plazoHoras: 24, modalidadEntrega, notasCliente: null, proveedor: p
});
const ficha = (id: number, nombre: string, ofertas: OfertaFicha[]): FichaProducto => ({
  id, sku: `S-${id}`, nombre, marca: null, formato: null, contenido: null, unidad: "unidad", categoriaId: 1, imagenUrl: null, descripcion: null,
  precioReferencia: null, categoria: { id: 1, nombre: "X", padre: null }, ofertas
});
// Leche de Los Andes (despacho o retiro) y tomate de Valle Central (solo despacho).
const FICHAS: Record<number, FichaProducto> = {
  9: ficha(9, "Leche entera", [oferta(17, 1090, prov(2, "Los Andes Food Service", 4990))]),
  15: ficha(15, "Tomate", [oferta(30, 1390, prov(3, "Valle Central Mayorista", 5990), "despacho")])
};
const ITEMS: ItemCarro[] = [
  { ofertaId: 17, cantidad: 20, precioVisto: 1090, precioActual: 1090, productoId: 9, nombreProducto: "Leche entera", formato: null, proveedorId: 2, disponible: true, cajasDisponibles: 20 },
  { ofertaId: 30, cantidad: 10, precioVisto: 1390, precioActual: 1390, productoId: 15, nombreProducto: "Tomate", formato: null, proveedorId: 3, disponible: true, cajasDisponibles: 40 }
];
const OPCIONES: OpcionesEntrega = {
  direcciones: [{ id: 6, calle: "Av. Irarrázaval", numero: "3450", complemento: "Local 2", referencia: null, comunaId: 20, comuna: "Ñuñoa", region: "Metropolitana de Santiago" }],
  puntosRetiro: [{ id: 1, proveedorId: 2, nombre: "Bodega Quilicura", horario: "Lun a Vie", direccion: "Av. Frei 9650, Quilicura" }]
};

describe("Checkout (KAN-95)", () => {
  let ctrl: HttpTestingController;
  let ir: jasmine.Spy;

  async function abrir(opciones: OpcionesEntrega = OPCIONES) {
    ir = jasmine.createSpy("ir");
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([{ path: "checkout", component: CheckoutComponent }, { path: "checkout/resultado", component: ResultadoPagoComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NavegadorPasarela, useValue: { ir } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    const h = await RouterTestingHarness.create();
    const c = await h.navigateByUrl("/checkout", CheckoutComponent);
    ctrl.match(`${API}/carro`).forEach((r) => r.flush({ id: 1, estado: "abierto", items: ITEMS }));
    ctrl.expectOne(`${API}/carro/opciones-entrega`).flush(opciones);
    await h.fixture.whenStable();
    h.detectChanges();
    ctrl.match((r) => r.url.startsWith(`${API}/catalogo/productos/`)).forEach((r) => r.flush(FICHAS[Number(r.request.url.split("/").pop())]!));
    await h.fixture.whenStable();
    h.detectChanges();
    return { h, c, el: h.routeNativeElement as HTMLElement };
  }

  const texto = (el: HTMLElement) => el.textContent!.replace(/\s+/g, " ");
  const radio = (el: HTMLElement, etiqueta: string) =>
    Array.from(el.querySelectorAll("label")).find((l) => l.textContent!.includes(etiqueta))!.querySelector("input") as HTMLInputElement;

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("tres pasos, una entrega por distribuidor (Valle Central solo despacha) y el total con despachos", async () => {
    const { el } = await abrir();
    const t = texto(el);
    expect(t).toContain("1 · Quién compra");
    expect(t).toContain("2 · Entrega");
    expect(t).toContain("3 · Pago");
    expect(t).toContain("Así llega tu pedido");
    expect(t).toContain("Av. Irarrázaval 3450, Local 2");
    const entregas = Array.from(el.querySelectorAll("fieldset.entrega")).map((f) => texto(f as HTMLElement));
    expect(entregas[0]).toContain("Retiro en Bodega Quilicura");
    expect(entregas[1]).not.toContain("Retiro");
    // 21.800 + 13.900 + despachos 4.990 + 5.990
    expect(el.querySelector(".pagar")!.textContent).toContain("Pagar $46.680");
  });

  it("Pagar: crea la orden con el retiro y la direccion elegidos, inicia el pago y envia a Webpay", async () => {
    const { h, c, el } = await abrir();
    radio(el, "Retiro en Bodega Quilicura").click();
    radio(el, "Empresa (factura)").click();
    h.detectChanges();
    expect(el.querySelector(".pagar")!.textContent).toContain("Pagar $41.690");

    const p = c.pagar();
    const conf = ctrl.expectOne(`${API}/carro/confirmar`);
    expect(conf.request.body).toEqual({ retiros: [{ proveedorId: 2, puntoRetiroId: 1 }], requiereFactura: true, direccionId: 6 });
    conf.flush({ ordenId: 12, codigo: "CM-90012", estado: "pendiente_pago", subtotal: 35700, costoDespachoTotal: 5990, total: 41690 });
    await Promise.resolve();
    const pago = ctrl.expectOne(`${API}/ordenes/12/pago`);
    expect(pago.request.body).toEqual({ medioPago: "tarjeta" });
    pago.flush({ ordenId: 12, codigo: "CM-90012", total: 41690, pasarela: "webpay", urlPago: "https://webpay/init", token: "tok" });
    await p;
    expect(ir).toHaveBeenCalledWith("https://webpay/init", "tok");
  });

  it("otra direccion: pide calle y comuna antes de pagar y la manda en el cuerpo", async () => {
    const { h, c, el } = await abrir();
    radio(el, "Otra dirección").click();
    ctrl.expectOne(`${API}/comunas`).flush([{ id: 23, nombre: "Providencia", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" }]);
    await h.fixture.whenStable();
    h.detectChanges();
    await c.pagar();
    h.detectChanges();
    expect(texto(el)).toContain("Indica la dirección de despacho: calle y comuna.");
    ctrl.expectNone(`${API}/carro/confirmar`);

    Object.assign(c.nueva, { calle: "Av. Providencia", numero: "2000", comunaId: 23, referencia: "Conserjería" });
    void c.pagar();
    const conf = ctrl.expectOne(`${API}/carro/confirmar`);
    expect(conf.request.body.direccion).toEqual({ comunaId: 23, calle: "Av. Providencia", numero: "2000", referencia: "Conserjería" });
    expect(conf.request.body.direccionId).toBeUndefined();
  });

  it("SIN_COBERTURA nombra al distribuidor; si el pago no inicia tras crear la orden, va al resultado para reintentar", async () => {
    const { h, c, el } = await abrir();
    const p1 = c.pagar();
    ctrl.expectOne(`${API}/carro/confirmar`).flush(
      { error: { code: "SIN_COBERTURA", detalle: { proveedores: [{ proveedorId: 3 }] } } },
      { status: 409, statusText: "x" }
    );
    await p1;
    h.detectChanges();
    expect(texto(el)).toContain("Valle Central Mayorista no despacha a esa comuna");
    expect(ir).not.toHaveBeenCalled();

    const nav = spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    const p2 = c.pagar();
    ctrl.expectOne(`${API}/carro/confirmar`).flush({ ordenId: 12, codigo: "CM-90012", estado: "pendiente_pago", subtotal: 0, costoDespachoTotal: 0, total: 0 });
    await Promise.resolve();
    ctrl.expectOne(`${API}/ordenes/12/pago`).flush({ error: { code: "X" } }, { status: 502, statusText: "x" });
    await p2;
    expect(nav).toHaveBeenCalledWith(["/checkout/resultado"], { queryParams: { orden: 12, pago: "error" } });
  });

  it("si el carro tiene algo por resolver (stock), no crea la orden y manda al carro", async () => {
    const { h, c, el } = await abrir();
    TestBed.inject(SessionState);
    ctrl.match(`${API}/carro`).forEach((r) => r.flush({ id: 1, estado: "abierto", items: [] }));
    c.carro.items.set([{ ...ITEMS[0]!, cantidad: 24 }]);
    h.detectChanges();
    await c.pagar();
    h.detectChanges();
    expect(texto(el)).toContain("Hay cosas por resolver en tu carro");
    expect(el.querySelector(".resumen a[href='/carro']")).not.toBeNull();
    ctrl.expectNone(`${API}/carro/confirmar`);
  });
});

describe("Resultado del pago (KAN-95)", () => {
  let ctrl: HttpTestingController;
  let ir: jasmine.Spy;
  const ORDEN: OrdenDetalle = {
    id: 12, codigo: "CM-90012", estado: "pagada", estadoPago: "pagado", medioPago: "tarjeta", creadaEn: "", pagadoEn: "", requiereFactura: false,
    subtotal: 67170, costoDespachoTotal: 12980, total: 80150,
    envios: [{ id: 30, proveedorId: 2, proveedorNombre: "Los Andes Food Service", modalidad: "retiro", plazoHoras: 24, costoDespacho: 0, subtotal: 21800, estado: "por_despachar", lineas: [] }]
  };

  async function abrir(url: string, orden: Partial<OrdenDetalle> = {}) {
    ir = jasmine.createSpy("ir");
    TestBed.configureTestingModule({
      imports: [ResultadoPagoComponent],
      providers: [provideRouter([{ path: "checkout/resultado", component: ResultadoPagoComponent }]), provideHttpClient(), provideHttpClientTesting(), { provide: NavegadorPasarela, useValue: { ir } }]
    });
    ctrl = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    const h = await RouterTestingHarness.create();
    const c = await h.navigateByUrl(url, ResultadoPagoComponent);
    ctrl.match(`${API}/carro`).forEach((r) => r.flush({ id: null, estado: "abierto", items: [] }));
    ctrl.expectOne(`${API}/ordenes/12`).flush({ ...ORDEN, ...orden });
    await h.fixture.whenStable();
    h.detectChanges();
    return { c, el: h.routeNativeElement as HTMLElement };
  }

  beforeEach(() => localStorage.clear());

  it("aprobado: folio, total pagado y como llega cada parte", async () => {
    const { el } = await abrir("/checkout/resultado?orden=12&pago=aprobado");
    const t = el.textContent!.replace(/\s+/g, " ");
    expect(t).toContain("¡Listo! Tu pago fue aprobado");
    expect(t).toContain("CM-90012");
    expect(t).toContain("$80.150");
    expect(t).toContain("Retiro en bodega");
  });

  it("rechazado: la orden sigue pendiente y 'Reintentar el pago' vuelve a Webpay", async () => {
    const { c, el } = await abrir("/checkout/resultado?orden=12&pago=rechazado", { estado: "pendiente_pago", estadoPago: "fallido" });
    expect(el.textContent).toContain("El pago fue rechazado");
    expect(el.textContent).toContain("pendiente de pago");
    const p = c.reintentar();
    ctrl.expectOne(`${API}/ordenes/12/pago`).flush({ ordenId: 12, codigo: "CM-90012", total: 80150, pasarela: "webpay", urlPago: "https://webpay/init", token: "tok-2" });
    await p;
    expect(ir).toHaveBeenCalledWith("https://webpay/init", "tok-2");
  });

  it("no confia solo en ?pago=: si la orden no esta pagada no dice aprobado", async () => {
    const { el } = await abrir("/checkout/resultado?orden=12&pago=aprobado", { estado: "pendiente_pago", estadoPago: "autorizado" });
    expect(el.textContent).not.toContain("¡Listo!");
    expect(el.textContent).toContain("No pudimos confirmar el pago");
  });
});
