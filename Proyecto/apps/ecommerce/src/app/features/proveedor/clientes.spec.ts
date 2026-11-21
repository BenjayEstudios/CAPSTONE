import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { ClienteProveedor } from "../../core/proveedor/ventas-proveedor.service";
import { ClientesProveedorComponent, formatearRut, lineaContacto, tonoRecompra } from "./clientes.component";

const API = environment.apiUrl;
const CLIENTES: ClienteProveedor[] = [
  {
    organizacionId: 6, nombre: "El Fogón", tipo: "Empresa", comuna: "Ñuñoa", ordenes: 4, pendientes: 0, monto: 361740, ultimaCompra: "2026-10-13T12:47:00Z",
    recompra: "Quincenal", contacto: { razonSocial: "Restaurante El Fogón Ltda.", rut: "76111222-8", email: "compras@elfogon.test", telefono: "+56 2 2274 5566" }
  },
  { organizacionId: 9, nombre: "María Paz Contreras", tipo: "Persona", comuna: "Santiago", ordenes: 0, pendientes: 1, monto: 0, ultimaCompra: null, recompra: "Por pagar", contacto: null }
];

describe("Tus clientes (KAN-106)", () => {
  let ctrl: HttpTestingController;

  async function montar(items = CLIENTES, total = items.length) {
    TestBed.configureTestingModule({ imports: [ClientesProveedorComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(ClientesProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/proveedor/clientes?pagina=1&tamano=50`).flush({ items, total, pagina: 1, totalPaginas: Math.ceil(total / 50) });
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();

  it("columnas: cliente, tipo, comuna, ordenes, comprado, ultima compra y recompra", async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll("thead th")).map(texto)).toEqual(["Cliente", "Tipo", "Comuna", "Órdenes", "Comprado", "Última compra", "Recompra"]);
    const [fogon, maria] = Array.from(el.querySelectorAll("tbody tr")).map(texto);
    expect(fogon).toContain("El Fogón");
    expect(fogon).toContain("compras@elfogon.test · 76.111.222-8 · +56 2 2274 5566");
    expect(fogon).toContain("Empresa");
    expect(fogon).toContain("Ñuñoa");
    expect(fogon).toContain("$361.740");
    expect(fogon).toContain("13 oct");
    expect(fogon).toContain("Quincenal");
    expect(texto(el.querySelector("h2")!)).toContain("2 clientes");
    expect(el.querySelector("h2 small")).not.toBeNull();
    expect(maria).toContain("Contacto disponible con su primera orden pagada");
    expect(maria).toContain("+1 por pagar");
    expect(maria).toContain("Por pagar");
  });

  it("sin clientes muestra el vacio; con mas de una pagina, ver mas", async () => {
    const f = await montar([CLIENTES[0]!], 51);
    const boton = (f.nativeElement as HTMLElement).querySelector(".mas button") as HTMLButtonElement;
    expect(texto((f.nativeElement as HTMLElement).querySelector(".mas")!)).toContain("1 de 51");
    boton.click();
    ctrl.expectOne(`${API}/proveedor/clientes?pagina=2&tamano=50`).flush({ items: [CLIENTES[1]], total: 51, pagina: 2, totalPaginas: 2 });
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.clientes()).toHaveSize(2);
  });

  it("textos de contacto y tonos", () => {
    expect(formatearRut("76111222-8")).toBe("76.111.222-8");
    expect(formatearRut("9876543-K")).toBe("9.876.543-K");
    expect(lineaContacto({ razonSocial: "X", rut: "12884019-8", email: null, telefono: null })).toBe("12.884.019-8");
    expect(tonoRecompra("Mensual")).toBe("frecuente");
    expect(tonoRecompra("Por pagar")).toBe("aviso");
    expect(tonoRecompra("Esporádica")).toBe("neutro");
  });
});
