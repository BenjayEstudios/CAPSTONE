import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { environment } from "../../../environments/environment";
import { NavegadorPasarela } from "../../core/checkout/checkout.service";
import { EnvioOrden, OrdenDetalle } from "../../core/models/checkout.models";
import { SessionState } from "../../core/state/session.state";
import { usuarioDePrueba } from "../../core/testing/usuario-de-prueba";
import { estadoOrden, pasosEnvio } from "./estados";
import { PedidoComponent } from "./pedido.component";
import { PedidosComponent } from "./pedidos.component";

const API = environment.apiUrl;
const envio = (id: number, proveedorNombre: string, modalidad: EnvioOrden["modalidad"], estado: string): EnvioOrden => ({
  id, proveedorId: id, proveedorNombre, modalidad, plazoHoras: 24, costoDespacho: 0, subtotal: 1000, estado, lineas: []
});
const orden = (id: number, estado: OrdenDetalle["estado"], extra: Partial<OrdenDetalle> = {}): OrdenDetalle => ({
  id, codigo: `CM-${90000 + id}`, estado, estadoPago: estado === "pendiente_pago" ? "autorizado" : "pagado", medioPago: "tarjeta",
  creadaEn: "2026-11-20T12:00:00.000Z", pagadoEn: estado === "pendiente_pago" ? null : "2026-11-20T12:05:00.000Z", requiereFactura: false,
  subtotal: 2000, costoDespachoTotal: 0, total: 85140, envios: [envio(1, "Los Andes Food Service", "despacho", "en_preparacion"), envio(2, "FrigoSur", "retiro", "listo_retiro")],
  ...extra
});
const pagina = (items: OrdenDetalle[], extra = {}) => ({ items, pagina: 1, tamano: 10, total: items.length, totalPaginas: 1, ...extra });

describe("Mis pedidos (KAN-98)", () => {
  let ctrl: HttpTestingController;

  async function abrir(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: "pedidos", component: PedidosComponent }, { path: "pedidos/:id", component: PedidoComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NavegadorPasarela, useValue: { ir: jasmine.createSpy("ir") } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl(url);
    ctrl.match(`${API}/carro`).forEach((r) => r.flush({ id: null, estado: "abierto", items: [] }));
    return h;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ");

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("lista folio, fecha, total, estado y el estado de cada envio", async () => {
    const h = await abrir("/pedidos");
    const req = ctrl.expectOne((r) => r.url.startsWith(`${API}/ordenes`));
    expect(req.request.url).toBe(`${API}/ordenes?pagina=1&tamano=10`);
    req.flush(pagina([orden(14, "pagada"), orden(13, "pendiente_pago", { estadoPago: "fallido" })]));
    await h.fixture.whenStable();
    h.detectChanges();
    const [primero, segundo] = Array.from(h.routeNativeElement!.querySelectorAll("a.pedido")).map(texto);
    expect(primero).toContain("CM-90014");
    expect(primero).toContain("Pagada");
    expect(primero).toContain("$85.140");
    expect(primero).toContain("2 distribuidores");
    expect(primero).toContain("Los Andes Food ServiceDespacho · En preparación");
    expect(primero).toContain("FrigoSurRetiro · Listo para retiro");
    expect(segundo).toContain("Pago no completado");
    expect(h.routeNativeElement!.querySelector("a.pedido")!.getAttribute("href")).toBe("/pedidos/14");
  });

  it("filtra por estado desde la URL y avisa si no hay pedidos en ese estado", async () => {
    const h = await abrir("/pedidos?estado=entregada");
    ctrl.expectOne(`${API}/ordenes?pagina=1&tamano=10&estado=entregada`).flush(pagina([]));
    await h.fixture.whenStable();
    h.detectChanges();
    expect(texto(h.routeNativeElement!)).toContain("No tienes pedidos en este estado");
    expect(h.routeNativeElement!.querySelector(".chip.activo")!.textContent).toContain("Entregados");
  });

  it("sin pedidos invita al catalogo; con varias paginas pagina por la URL", async () => {
    const h = await abrir("/pedidos");
    ctrl.expectOne((r) => r.url.startsWith(`${API}/ordenes`)).flush(pagina([]));
    await h.fixture.whenStable();
    h.detectChanges();
    expect(texto(h.routeNativeElement!)).toContain("Todavía no tienes pedidos");

    await h.navigateByUrl("/pedidos?pagina=2");
    ctrl.expectOne(`${API}/ordenes?pagina=2&tamano=10`).flush(pagina([orden(3, "entregada")], { pagina: 2, total: 11, totalPaginas: 2 }));
    await h.fixture.whenStable();
    h.detectChanges();
    expect(texto(h.routeNativeElement!)).toContain("Página 2 de 2");
  });

  it("detalle: seguimiento por envio y descarga de la boleta", async () => {
    const h = await abrir("/pedidos/14");
    ctrl.expectOne(`${API}/ordenes/14`).flush(orden(14, "en_preparacion"));
    await h.fixture.whenStable();
    ctrl.expectOne(`${API}/documentos-tributarios?ordenId=14&tamano=50`).flush({
      items: [{ id: 28, tipoDte: 39, tipoNombre: "BOLETA", folio: 1, ordenId: 14, ordenEnvioId: null, total: 85140, emitidoEn: "", pdfUrl: "" }]
    });
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement!;
    expect(texto(el)).toContain("Pedido CM-90014");
    expect(texto(el)).toContain("Boleta electrónica N.º 1 (PDF)");
    const [despacho, retiro] = Array.from(el.querySelectorAll("ol.seguimiento"));
    expect(despacho!.querySelector("[aria-current=step]")!.textContent).toContain("En preparación");
    expect(Array.from(retiro!.querySelectorAll("li")).map((li) => li.textContent!.trim())).toEqual(["Por despachar", "En preparación", "Listo para retiro", "Entregado"]);
    expect(retiro!.querySelector("[aria-current=step]")!.textContent).toContain("Listo para retiro");
  });

  it("detalle pendiente de pago: 'Pagar ahora' inicia Webpay, sin seguimiento ni documentos", async () => {
    const h = await abrir("/pedidos/13");
    ctrl.expectOne(`${API}/ordenes/13`).flush(orden(13, "pendiente_pago"));
    await h.fixture.whenStable();
    h.detectChanges();
    ctrl.expectNone((r) => r.url.startsWith(`${API}/documentos-tributarios`));
    const el = h.routeNativeElement!;
    expect(el.querySelector("ol.seguimiento")).toBeNull();
    (Array.from(el.querySelectorAll("button")).find((b) => b.textContent!.includes("Pagar ahora")) as HTMLButtonElement).click();
    ctrl.expectOne(`${API}/ordenes/13/pago`).flush({ ordenId: 13, codigo: "CM-90013", total: 85140, pasarela: "webpay", urlPago: "https://webpay/init", token: "t" });
    await h.fixture.whenStable();
    expect(TestBed.inject(NavegadorPasarela).ir).toHaveBeenCalledWith("https://webpay/init", "t");
  });

  it("pasos y estados", () => {
    expect(pasosEnvio({ modalidad: "despacho", estado: "despachado" }).map((p) => [p.etiqueta, p.hecho, p.actual])).toEqual([
      ["Por despachar", true, false], ["En preparación", true, false], ["Despachado", true, true], ["Entregado", false, false]
    ]);
    expect(pasosEnvio({ modalidad: "despacho", estado: "cancelado" })).toEqual([]);
    expect(estadoOrden({ estado: "pendiente_pago", estadoPago: "autorizado" })).toBe("Pendiente de pago");
    expect(estadoOrden({ estado: "despachada", estadoPago: "pagado" })).toBe("Despachada");
  });
});
