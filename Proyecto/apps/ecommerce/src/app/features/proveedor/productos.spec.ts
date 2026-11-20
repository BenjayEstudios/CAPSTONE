import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { OfertaProveedor } from "../../core/proveedor/ofertas-proveedor.service";
import { estadoVisible, MisProductosComponent, textoCambio } from "./productos.component";

const API = environment.apiUrl;
const oferta = (id: number, nombre: string, extra: Partial<OfertaProveedor> = {}): OfertaProveedor => ({
  id, productoId: id, precioUnitario: 12490, unidadesPorCaja: 4, cajasDisponibles: 40, cajasIniciales: 40, minimoCompra: null, plazoHoras: 24,
  modalidadEntrega: "ambos", notasCliente: null, estado: "publicada", actualizadaEn: "2026-11-20T12:00:00Z",
  producto: { id, sku: `SKU-${id}`, nombre, formato: "Bidón 5 L", unidad: "L", contenido: 5, precioReferencia: 12990, topeSobreReferenciaPct: 30 },
  ...extra
});
const OFERTAS = [
  oferta(1, "Aceite vegetal maravilla"),
  oferta(17, "Leche entera", { precioUnitario: 1090, cajasDisponibles: 0, unidadesPorCaja: 12, producto: { id: 9, sku: "LEC-0001", nombre: "Leche entera", formato: "Caja 1 L", unidad: "L", contenido: 1, precioReferencia: 1190, topeSobreReferenciaPct: 30 } }),
  oferta(30, "Tomate larga vida", { estado: "pausada" }),
  oferta(31, "Palta Hass", { estado: "borrador" })
];

describe("Mis productos publicados (KAN-103)", () => {
  let ctrl: HttpTestingController;

  async function montar() {
    TestBed.configureTestingModule({ imports: [MisProductosComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(MisProductosComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/ofertas?pagina=1&tamano=100`).flush({ items: OFERTAS, total: OFERTAS.length });
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const filas = (el: HTMLElement) => Array.from(el.querySelectorAll("tbody tr:not(.editor)")).map((r) => r.textContent!.replace(/\s+/g, " ").trim());

  it("tabla: producto, formato, precio, unitario, cajas, unidades, despacho, minimo y estado", async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    const encabezados = Array.from(el.querySelectorAll("thead th")).map((t) => t.textContent!.trim());
    expect(encabezados.slice(0, 9)).toEqual(["Producto", "Formato", "Tu precio", "Unitario", "Cajas", "Unidades", "Despacho", "Mínimo", "Estado"]);
    const aceite = filas(el).find((r) => r.startsWith("Aceite"))!;
    expect(aceite).toContain("Bidón 5 L");
    expect(aceite).toContain("$12.490");
    expect(aceite).toContain("$2.498/L");
    expect(aceite).toContain("160 un.");
    expect(aceite).toContain("24 h · despacho o retiro");
    expect(aceite).toContain("Publicada");
    expect(filas(el).find((r) => r.startsWith("Leche"))).toContain("Sin stock");
    expect(el.querySelector("h2")!.textContent).toContain("2 publicadas · 1 pausadas · 1 borradores");
  });

  it("filtra por estado y por texto", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.filtro.set("pausada");
    f.detectChanges();
    expect(filas(f.nativeElement)).toHaveSize(1);
    c.filtro.set(null);
    c.q.set("lec-0001");
    f.detectChanges();
    expect(filas(f.nativeElement)[0]).toContain("Leche entera");
  });

  it("editar precio y stock manda el cambio con motivo y recarga el historial", async () => {
    const f = await montar();
    const c = f.componentInstance;
    void c.editar(OFERTAS[0]!);
    ctrl.expectOne(`${API}/ofertas/1/historial`).flush({ items: [] });
    await f.whenStable();
    c.precio.set(11990);
    c.cajas.set(55);
    c.motivo.set("Llegó un camión");
    const p = c.guardar(OFERTAS[0]!);
    const req = ctrl.expectOne(`${API}/ofertas/1`);
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual({ precioUnitario: 11990, cajasDisponibles: 55, motivo: "Llegó un camión" });
    req.flush({ oferta: { ...OFERTAS[0]!, precioUnitario: 11990, cajasDisponibles: 55 }, revisionPrecio: null });
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${API}/ofertas/1/historial`).flush({
      items: [{ id: 9, precioAnterior: 12490, precioNuevo: 11990, cajasAnteriores: 40, cajasNuevas: 55, motivo: "Llegó un camión", cambiadoPor: "Ventas", cambiadoEn: "2026-11-20T23:00:00Z" }]
    });
    await p;
    f.detectChanges();
    const texto = f.nativeElement.textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Guardado. El cambio quedó en el historial de la oferta.");
    expect(texto).toContain("Precio $12.490 → $11.990 · Cajas 40 → 55");
    expect(filas(f.nativeElement).find((r) => r.startsWith("Aceite"))).toContain("$11.990");
  });

  it("pausar y reactivar; sobre el tope una publicada no se guarda", async () => {
    const f = await montar();
    const c = f.componentInstance;
    const p1 = c.pausar(OFERTAS[0]!);
    const r1 = ctrl.expectOne(`${API}/ofertas/1`);
    expect(r1.request.body).toEqual({ estado: "pausada" });
    r1.flush({ oferta: { ...OFERTAS[0]!, estado: "pausada" }, revisionPrecio: null });
    await p1;
    f.detectChanges();
    expect(filas(f.nativeElement).find((r) => r.startsWith("Aceite"))).toContain("Pausada");
    expect(f.nativeElement.textContent).toContain("quedó pausada");

    const p2 = c.reactivar(OFERTAS[2]!);
    const r2 = ctrl.expectOne(`${API}/ofertas/30`);
    expect(r2.request.body).toEqual({ estado: "publicada" });
    r2.flush({ error: { code: "PRECIO_SOBRE_TOPE" } }, { status: 409, statusText: "x" });
    await p2;
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain("Ese precio supera el tope de publicación de la ficha.");

    void c.editar(OFERTAS[1]!);
    ctrl.expectOne(`${API}/ofertas/17/historial`).flush({ items: [] });
    c.precio.set(9999);
    f.detectChanges();
    expect(c.sobreTope(OFERTAS[1]!)).toBeTrue();
    expect((f.nativeElement.querySelector(".editor button[type=submit]") as HTMLButtonElement).disabled).toBeTrue();
  });

  it("estados y textos del historial", () => {
    expect(estadoVisible({ estado: "publicada", cajasDisponibles: 20 }).texto).toBe("Stock bajo");
    expect(estadoVisible({ estado: "publicada", cajasDisponibles: 21 }).texto).toBe("Publicada");
    expect(estadoVisible({ estado: "borrador", cajasDisponibles: 0 }).texto).toBe("Borrador");
    expect(textoCambio({ id: 1, precioAnterior: null, precioNuevo: 7000, cajasAnteriores: null, cajasNuevas: 30, motivo: null, cambiadoPor: null, cambiadoEn: "" })).toBe("Alta a $7.000, 30 cajas");
  });
});
