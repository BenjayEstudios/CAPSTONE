import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { VentaProveedor } from "../../core/proveedor/ventas-proveedor.service";
import { textoAccion, VentasProveedorComponent } from "./ventas.component";

const API = environment.apiUrl;
const venta = (envioId: number, extra: Partial<VentaProveedor> = {}): VentaProveedor => ({
  envioId, ordenId: envioId + 100, folio: `CM-${10000 + envioId}`, cliente: "Restaurante El Fogón", modalidad: "despacho", comuna: "Providencia",
  fecha: "2026-11-18T15:00:00Z", lineas: 3, cajas: 12, monto: 184500, estado: "por_despachar", ordenEstado: "pagada", siguiente: "en_preparacion", ...extra
});
const VENTAS = [
  venta(1),
  venta(2, { estado: "en_preparacion", modalidad: "retiro", comuna: "Quilicura", siguiente: "listo_retiro" }),
  venta(3, { estado: "entregado", siguiente: null, monto: 1106400, cajas: 1380 })
];
const CONTEO = { por_despachar: 1, en_preparacion: 1, entregado: 1 };

describe("Órdenes de venta del proveedor (KAN-105)", () => {
  let ctrl: HttpTestingController;

  async function montar() {
    TestBed.configureTestingModule({ imports: [VentasProveedorComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(VentasProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/proveedor/ventas?pagina=1&tamano=50`).flush({ items: VENTAS, conteo: CONTEO, pagina: 1, tamano: 50, total: 3, totalPaginas: 1 });
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();
  const filas = (el: HTMLElement) => Array.from(el.querySelectorAll("tbody tr:not(.fila-error)")).map(texto);

  it("tabla: folio, cliente, comuna, fecha, lineas, cajas, monto y estado", async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll("thead th")).map(texto).slice(0, 8)).toEqual(["Folio", "Cliente", "Comuna", "Fecha", "Líneas", "Cajas", "Monto", "Estado"]);
    const [primera, segunda, tercera] = filas(el);
    expect(primera).toContain("CM-10001");
    expect(primera).toContain("Restaurante El Fogón");
    expect(primera).toContain("Providencia");
    expect(primera).toContain("18 nov");
    expect(primera).toContain("$184.500");
    expect(primera).toContain("Por despachar");
    expect(primera).toContain("Preparar");
    expect(segunda).toContain("Retiro en bodega");
    expect(segunda).toContain("Marcar listo para retiro");
    expect(tercera).toContain("1.380");
    expect(tercera).toContain("Entregado");
    expect(tercera).not.toContain("Marcar");
    expect(texto(el.querySelector("h2")!)).toContain("3 órdenes · 1 por despachar");
  });

  it("filtros con su conteo; elegir uno pide ese estado", async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    const chips = Array.from(el.querySelectorAll(".chip")).map(texto);
    expect(chips).toEqual(["Todas 3", "Por despachar 1", "En preparación 1", "Entregados 1"]);
    (el.querySelectorAll(".chip")[1] as HTMLButtonElement).click();
    ctrl.expectOne(`${API}/proveedor/ventas?pagina=1&tamano=50&estado=por_despachar`).flush({ items: [VENTAS[0]], conteo: CONTEO, pagina: 1, tamano: 50, total: 1, totalPaginas: 1 });
    await f.whenStable();
    f.detectChanges();
    expect(filas(el)).toHaveSize(1);
    expect(el.querySelector(".chip.activo")!.textContent).toContain("Por despachar");
  });

  it("avanzar el estado manda el siguiente y recarga la lista", async () => {
    const f = await montar();
    const p = f.componentInstance.avanzar(VENTAS[0]!);
    const req = ctrl.expectOne(`${API}/ordenes/envios/1/estado`);
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual({ estado: "en_preparacion" });
    req.flush({ id: 1, ordenId: 101, estado: "en_preparacion", ordenEstado: "en_preparacion" });
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${API}/proveedor/ventas?pagina=1&tamano=50`).flush({
      items: [venta(1, { estado: "en_preparacion", siguiente: "despachado" }), VENTAS[1], VENTAS[2]],
      conteo: { en_preparacion: 2, entregado: 1 }, pagina: 1, tamano: 50, total: 3, totalPaginas: 1
    });
    await p;
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(texto(el.querySelector(".mensaje.ok")!)).toContain("CM-10001 · Restaurante El Fogón: en preparación.");
    expect(filas(el)[0]).toContain("Marcar despachado");
    expect(texto(el.querySelector("h2")!)).not.toContain("por despachar");
  });

  it("si el envio ya cambio (409) avisa en la fila y recarga", async () => {
    const f = await montar();
    const p = f.componentInstance.avanzar(VENTAS[0]!);
    ctrl.expectOne(`${API}/ordenes/envios/1/estado`).flush({ error: { code: "TRANSICION_INVALIDA" } }, { status: 409, statusText: "x" });
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${API}/proveedor/ventas?pagina=1&tamano=50`).flush({ items: VENTAS, conteo: CONTEO, pagina: 1, tamano: 50, total: 3, totalPaginas: 1 });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".fila-error"))).toContain("Ese envío ya cambió de estado.");
  });

  it("textos de la accion", () => {
    expect(textoAccion("en_preparacion")).toBe("Preparar");
    expect(textoAccion("despachado")).toBe("Marcar despachado");
    expect(textoAccion("listo_retiro")).toBe("Marcar listo para retiro");
    expect(textoAccion("entregado")).toBe("Marcar entregado");
  });
});
