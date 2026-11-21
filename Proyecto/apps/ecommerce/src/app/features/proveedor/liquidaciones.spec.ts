import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { Liquidacion } from "../../core/proveedor/panel-proveedor.service";
import { LiquidacionesProveedorComponent, textoFechaPago, textoPeriodo } from "./liquidaciones.component";

const API = environment.apiUrl;
const liq = (id: number, desde: string, hasta: string, neto: number, estado: Liquidacion["estado"], pagadaEn: string | null): Liquidacion => ({
  id, proveedorId: 2, periodoDesde: desde, periodoHasta: hasta, montoBruto: neto + 8000, comision: 8000, montoNeto: neto, estado, pagadaEn
});
const LISTA = [
  liq(14, "2026-10-12", "2026-10-18", 97367, "pendiente", null),
  liq(10, "2026-09-28", "2026-10-04", 48506, "pagada", "2026-10-06T14:00:00Z")
];
const ALERTAS = {
  documentos: [], stockBajo: [], enviosPorDespachar: 0, ofertas: { publicadas: 13, borradores: 0 },
  porCobrar: { entregadoSinLiquidar: 30000, liquidacionesPendientes: 97367, total: 127367, proximaLiquidacion: "2026-11-24" }
};

describe("Liquidaciones del proveedor (KAN-111)", () => {
  let ctrl: HttpTestingController;

  async function montar(total = LISTA.length) {
    TestBed.configureTestingModule({ imports: [LiquidacionesProveedorComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(LiquidacionesProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/alertas/proveedor`).flush(ALERTAS);
    ctrl.expectOne(`${API}/liquidaciones/mias?pagina=1&tamano=20`).flush({ items: LISTA, total, pagina: 1, totalPaginas: Math.ceil(total / 20) });
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();
  const celdas = (tr: Element) => Array.from(tr.querySelectorAll(":scope > th, :scope > td")).map(texto);

  it("por cobrar: lo entregado sin liquidar mas las liquidaciones sin pagar, y la proxima liquidacion", async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    expect(texto(el.querySelector(".por-cobrar .monto")!)).toBe("$127.367");
    const pc = texto(el.querySelector(".por-cobrar")!);
    expect(pc).toContain("$30.000");
    expect(pc).toContain("$97.367");
    expect(pc).toContain("martes, 24 de noviembre");
  });

  it("lista: periodo, bruto, comision, neto, estado y fecha de pago", async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll(".tabla > thead th")).map(texto).slice(0, 6)).toEqual(["Período", "Bruto", "Comisión", "Neto", "Estado", "Fecha de pago"]);
    const [pendiente, pagada] = Array.from(el.querySelectorAll(".tabla > tbody > tr"));
    expect(celdas(pendiente!).slice(0, 6)).toEqual(["12 al 18 oct", "$105.367", "−$8.000", "$97.367", "Por pagar", "—"]);
    expect(celdas(pagada!).slice(0, 6)).toEqual(["28 sept al 4 oct", "$56.506", "−$8.000", "$48.506", "Pagada", "6 oct"]);
  });

  it("ver envios abre el detalle de la liquidacion con sus envios y el total", async () => {
    const f = await montar();
    const c = f.componentInstance;
    const p = c.alternar(LISTA[0]!);
    ctrl.expectOne(`${API}/liquidaciones/mias/14`).flush({
      ...LISTA[0],
      envios: [
        { envioId: 17, ordenId: 9, ordenCodigo: "CM-10009", entregadoEn: "2026-10-14T12:45:00Z", montoBruto: 105400, comision: 8033, montoNeto: 97367 }
      ]
    });
    await p;
    f.detectChanges();
    const detalle = f.nativeElement.querySelector("tr.detalle") as HTMLElement;
    expect(celdas(detalle.querySelector(".envios tbody tr")!)).toEqual(["CM-10009", "14 oct", "$105.400", "−$8.033", "$97.367"]);
    expect(texto(detalle.querySelector("tfoot")!)).toContain("1 envío");
    c.alternar(LISTA[0]!);
    f.detectChanges();
    expect(f.nativeElement.querySelector("tr.detalle")).toBeNull();
  });

  it("ver mas trae la pagina siguiente", async () => {
    const f = await montar(25);
    const c = f.componentInstance;
    expect(texto(f.nativeElement.querySelector(".mas"))).toContain("2 de 25");
    const p = c.verMas();
    ctrl.expectOne(`${API}/liquidaciones/mias?pagina=2&tamano=20`).flush({ items: [liq(1, "2026-08-31", "2026-09-06", 105270, "pagada", "2026-09-08T14:00:00Z")], total: 25, pagina: 2, totalPaginas: 2 });
    await p;
    expect(c.liquidaciones()).toHaveSize(3);
  });

  it("textos de periodo y fecha", () => {
    expect(textoPeriodo("2026-10-12", "2026-10-18")).toBe("12 al 18 oct");
    expect(textoPeriodo("2026-09-28", "2026-10-04")).toBe("28 sept al 4 oct");
    expect(textoFechaPago(null)).toBe("—");
  });
});
