import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { AlertasProveedor, VentasProveedor } from "../../core/proveedor/panel-proveedor.service";
import { rangosDashboard, semanaIso, textoVariacion } from "./dashboard.calculo";
import { RELOJ } from "../../core/reloj";
import { armarAlertas, DashboardProveedorComponent } from "./dashboard.component";

const API = environment.apiUrl;
const HOY = new Date("2026-11-20T15:00:00Z");
const ventas = (ventasTotales: number, envios: number, semanas: VentasProveedor["semanas"] = [], productos: VentasProveedor["productos"] = []): VentasProveedor => ({
  desde: "", hasta: "", totales: { envios, ventas: ventasTotales, despacho: 0, comision: 0, neto: ventasTotales }, semanas, productos
});
const semana = (s: string, v: number) => ({ semana: s, envios: v ? 1 : 0, ventas: v, despacho: 0, comision: 0, neto: v });
const ALERTAS: AlertasProveedor = {
  documentos: [
    { tipo: "carpeta_tributaria", venceEn: "2026-11-17", revision: "aprobado", estado: "vencido", diasParaVencer: -3 },
    { tipo: "resolucion_sanitaria", venceEn: "2026-12-20", revision: "aprobado", estado: "por_vencer", diasParaVencer: 30 },
    { tipo: "vigencia", venceEn: null, revision: null, estado: "falta", diasParaVencer: null }
  ],
  stockBajo: [{ ofertaId: 17, productoId: 9, producto: "Leche entera", cajasDisponibles: 0, cajasIniciales: 39 }],
  porCobrar: { entregadoSinLiquidar: 0, liquidacionesPendientes: 97367, total: 97367, proximaLiquidacion: "2026-11-24" },
  enviosPorDespachar: 2,
  ofertas: { publicadas: 13, borradores: 1 }
};

describe("Dashboard del proveedor (KAN-101)", () => {
  it("rangos: mes a la fecha, el mismo tramo del mes anterior y 12 semanas desde un lunes", () => {
    expect(rangosDashboard(HOY)).toEqual({
      mes: { desde: "2026-11-01", hasta: "2026-11-20" },
      mesAnterior: { desde: "2026-10-01", hasta: "2026-10-20" },
      semanas: { desde: "2026-08-31", hasta: "2026-11-20" }
    });
    // 31 de marzo: el tramo de febrero se corta en su ultimo dia.
    expect(rangosDashboard(new Date("2026-03-31T12:00:00Z")).mesAnterior).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(semanaIso("2026-11-16")).toBe(47);
    expect(textoVariacion(114, 100, "octubre")).toBe("+14 % vs. octubre");
    expect(textoVariacion(97, 100, "octubre")).toBe("−3 % vs. octubre");
    expect(textoVariacion(50, 0, "octubre")).toBe("sin ventas en el mismo tramo de octubre");
  });

  it("Requiere atencion: documentos, stock, envios, borradores y cobro", () => {
    const a = armarAlertas(ALERTAS).map((x) => `${x.etiqueta}|${x.tono}|${x.texto}`);
    expect(a).toEqual([
      "Documento|urgente|Carpeta tributaria: venció el 17 de noviembre. Súbela de nuevo para seguir vendiendo.",
      "Documento|aviso|Resolución sanitaria: vence en 30 días (20 de diciembre).",
      "Documento|urgente|Certificado de vigencia: todavía no la subes.",
      "Stock bajo|urgente|Leche entera: sin stock; los compradores ya no pueden pedirlo.",
      "Órdenes|aviso|2 envíos pagados esperan que lo prepares.",
      "Borrador|info|1 oferta está en borrador, sin publicar.",
      "Cobro|info|$97.367 por cobrar. Próxima liquidación: martes, 24 de noviembre."
    ]);
  });

  it("pide el mes, el tramo anterior, 12 semanas y las alertas, y muestra KPIs, grafico y top", async () => {
    TestBed.configureTestingModule({
      imports: [DashboardProveedorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RELOJ, useValue: () => HOY }]
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(DashboardProveedorComponent);
    const carga = f.componentInstance.cargar();
    ctrl.match(`${API}/estadisticas/proveedor/ventas?desde=2026-11-01&hasta=2026-11-20`).forEach((r) => r.flush(ventas(228000, 2)));
    ctrl.match(`${API}/estadisticas/proveedor/ventas?desde=2026-10-01&hasta=2026-10-20`).forEach((r) => r.flush(ventas(200000, 2)));
    const semanas = Array.from({ length: 12 }, (_, i) => semana(new Date(Date.UTC(2026, 7, 31 + i * 7)).toISOString().slice(0, 10), i === 3 ? 0 : (i + 1) * 10000));
    ctrl.match(`${API}/estadisticas/proveedor/ventas?desde=2026-08-31&hasta=2026-11-20`).forEach((r) =>
      r.flush(ventas(0, 0, semanas, [{ productoId: 1, nombre: "Aceite vegetal maravilla", unidades: 12, ventas: 149880 }]))
    );
    ctrl.match(`${API}/alertas/proveedor`).forEach((r) => r.flush(ALERTAS));
    await carga;
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const texto = el.textContent!.replace(/\s+/g, " ");
    expect(texto).toContain("Ventas de noviembre");
    expect(texto).toContain("comparadas con el mismo tramo de octubre");
    const kpis = Array.from(el.querySelectorAll(".kpi")).map((k) => k.textContent!.replace(/\s+/g, " ").trim());
    expect(kpis[0]).toContain("$228.000");
    expect(kpis[0]).toContain("+14 % vs. octubre");
    expect(kpis[1]).toContain("2");
    expect(kpis[2]).toContain("$114.000");
    expect(kpis[3]).toContain("13");
    expect(kpis[3]).toContain("1 en borrador sin publicar");
    expect(el.querySelectorAll(".columna")).toHaveSize(12);
    expect(el.querySelector(".columna.actual .rotulo")!.textContent).toContain("Esta");
    expect(el.querySelectorAll(".visualmente-oculto tbody tr")).toHaveSize(12);
    expect(texto).toContain("Aceite vegetal maravilla");
    expect(texto).toContain("12 cajas");
    expect(el.querySelectorAll(".avisos li")).toHaveSize(7);
  });
});
