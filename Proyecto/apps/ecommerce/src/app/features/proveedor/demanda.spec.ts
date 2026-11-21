import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { DemandaProveedor } from "../../core/proveedor/panel-proveedor.service";
import { RELOJ } from "../../core/reloj";
import { anchoBarra, DemandaProveedorComponent, desdeHace, textoPorcentaje } from "./demanda.component";

const API = environment.apiUrl;
const HOY = new Date("2026-11-20T15:00:00Z");
const DATOS: DemandaProveedor = {
  desde: "2026-10-22",
  hasta: "2026-11-20",
  inicioMes: "2026-11-01",
  productos: [
    { ofertaId: 1, productoId: 1, producto: "Aceite vegetal maravilla", formato: "Bidón 5 L", vistas: 173, clicks: 48, conversion: 27.7, cajasVendidas: 12 },
    { ofertaId: 27, productoId: 13, producto: "Pechuga de pollo", formato: "Bolsa 1 kg", vistas: 169, clicks: 8, conversion: 4.7, cajasVendidas: 0 }
  ],
  restantes: [
    { ofertaId: 17, productoId: 9, producto: "Leche entera", formato: "Caja 1 L", cajas: 0, cajasInicioMes: 39, porcentaje: 0 },
    { ofertaId: 5, productoId: 3, producto: "Arroz grado 1", formato: "Saco 5 kg", cajas: 30, cajasInicioMes: 45, porcentaje: 67 }
  ],
  potenciales: [
    { comunaId: 20, comuna: "Ñuñoa", region: "Metropolitana de Santiago", clientes: 4, cubre: true },
    { comunaId: 90, comuna: "Concepción", region: "Biobío", clientes: 2, cubre: false }
  ]
};

describe("Demanda y cobertura (KAN-107)", () => {
  let ctrl: HttpTestingController;

  async function montar(datos = DATOS) {
    TestBed.configureTestingModule({
      imports: [DemandaProveedorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RELOJ, useValue: () => HOY }]
    });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(DemandaProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/proveedor/demanda?desde=2026-10-22`).flush(datos);
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();
  // Texto de cada celda o parte de la fila, separado por " | " (textContent las pega).
  const partes = (el: Element) =>
    Array.from(el.querySelectorAll("th, td, .nombre, small, .detalle, .valor"))
      .filter((x) => !x.querySelector("small, .nombre"))
      .map(texto)
      .join(" | ");

  it("mas vistos con vistas, clicks, conversion y cajas vendidas", async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll("thead th")).map(texto)).toEqual(["Producto", "Vistas", "Clicks", "Conversión", "Cajas vendidas"]);
    expect(partes(el.querySelector("tbody tr")!)).toBe("Aceite vegetal maravilla | Bidón 5 L | 173 | 48 | 27,7 % | 12");
    expect(el.querySelector("td.alta")!.textContent).toContain("27,7 %");
    expect(texto(el.querySelector(".bajada")!)).toContain("Datos del 22 oct al 20 nov.");
  });

  it("productos restantes y clientes potenciales con cobertura", async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    const [restantes, potenciales] = Array.from(el.querySelectorAll(".barras")).map((ul) => Array.from(ul.querySelectorAll("li")));
    expect(partes(restantes![0]!)).toBe("Leche entera | 0 de 39 cajas | 0 %");
    expect(restantes![0]!.classList).toContain("bajo");
    expect(partes(restantes![1]!)).toBe("Arroz grado 1 | 30 de 45 cajas | 67 %");
    expect(texto(potenciales![0]!)).toContain("Ñuñoa");
    expect(partes(potenciales![0]!)).toBe("Metropolitana de Santiago | Despachas | 4");
    expect(texto(potenciales![1]!)).toContain("Sin cobertura");
    expect(potenciales![1]!.classList).toContain("sin-cobertura");
    expect((potenciales![1]!.querySelector(".barra span") as HTMLElement).style.width).toBe("50%");
  });

  it("sin actividad en 30 dias ofrece mirar 90", async () => {
    const vacio = { ...DATOS, productos: DATOS.productos.map((p) => ({ ...p, vistas: 0, clicks: 0, conversion: null, cajasVendidas: 0 })), potenciales: [] };
    const f = await montar(vacio);
    const el = f.nativeElement as HTMLElement;
    expect(texto(el.querySelector(".vacio")!)).toContain("Sin visitas ni ventas en este período.");
    (el.querySelector(".vacio .btn-link") as HTMLButtonElement).click();
    ctrl.expectOne(`${API}/proveedor/demanda?desde=2026-08-23`).flush(DATOS);
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.dias()).toBe(90);
    expect(el.querySelector(".chip.activo")!.textContent).toContain("90");
  });

  it("calculos", () => {
    expect(desdeHace(30, HOY)).toBe("2026-10-22");
    expect(desdeHace(90, HOY)).toBe("2026-08-23");
    expect(textoPorcentaje(null)).toBe("—");
    expect(textoPorcentaje(4.7)).toBe("4,7 %");
    expect(anchoBarra(2, 4)).toBe("50%");
    expect(anchoBarra(3, 0)).toBe("0%");
  });
});
