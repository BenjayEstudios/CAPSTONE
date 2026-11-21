import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { precioMaximo, ProductoDisponible } from "../../core/proveedor/ofertas-proveedor.service";
import { AsignarProductoComponent, posicionFrente } from "./asignar.component";

const API = environment.apiUrl;
const CREMA: ProductoDisponible = {
  id: 10, sku: "CRE-0001", nombre: "Crema para batir 35% MG", marca: "Soprole", formato: "Caja 1 L", unidad: "L", contenido: 1,
  categoriaId: 11, precioReferencia: 5490, topeSobreReferenciaPct: 30
};
const CONDICIONES = {
  horaCorte: "14:00", despachoGratisDesde: 150000, plazoEstandarHoras: 24, ofreceDespacho: true, ofreceRetiro: true,
  zonas: [{ comunaId: null, comuna: null, regionCodigo: "13", region: "Metropolitana de Santiago", costoDespacho: 4990, plazoHoras: 24 }]
};

describe("Asignarme un producto (KAN-102)", () => {
  let ctrl: HttpTestingController;

  async function montar() {
    TestBed.configureTestingModule({ imports: [AsignarProductoComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(AsignarProductoComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/ofertas/productos-disponibles?tamano=20`).flush({ items: [CREMA], total: 1 });
    ctrl.expectOne(`${API}/proveedor/cobertura`).flush(CONDICIONES);
    await f.whenStable();
    f.detectChanges();
    const p = f.componentInstance.elegir(CREMA);
    ctrl.expectOne(`${API}/catalogo/productos/10`).flush({ ofertas: [{ precioUnitario: 5190 }, { precioUnitario: 5390 }] });
    await p;
    f.detectChanges();
    return f;
  }
  const texto = (el: HTMLElement) => el.textContent!.replace(/\s+/g, " ");

  it("tope y posicion frente a otros", () => {
    expect(precioMaximo(CREMA)).toBe(7137);
    expect(precioMaximo({ precioReferencia: null, topeSobreReferenciaPct: 30 })).toBeNull();
    expect(posicionFrente(5000, [5190, 5390])).toBe("Serías el más barato de 3: el siguiente cobra $5.190.");
    expect(posicionFrente(5390, [5190, 5390])).toBe("Quedarías 2.º de 3: el más barato cobra $5.190 ($200 menos).");
    expect(posicionFrente(5190, [5190])).toBe("Empatarías con el más barato ($5.190) entre 2 distribuidores.");
    expect(posicionFrente(5000, [])).toBe("Serías el único distribuidor de este producto.");
  });

  it("busca en el catalogo maestro, calcula stock, valor, precio por L y posicion, y muestra las condiciones de entrega", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.precio.set(5000);
    c.porCaja.set(12);
    c.cajas.set(30);
    f.detectChanges();
    const t = texto(f.nativeElement);
    expect(t).toContain("Crema para batir 35% MG");
    expect(t).toContain("360 unidades");
    expect(t).toContain("$1.800.000");
    expect(t).toContain("$5.000/L");
    expect(t).toContain("Serías el más barato de 3");
    expect(t).toContain("Corte de pedidos: 14:00");
    expect(t).toContain("Despacho gratis desde: $150.000");
    expect(t).toContain("Toda la región Metropolitana de Santiago: $4.990");
  });

  it("sobre el tope no deja publicar; como borrador si, y lo avisa", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.precio.set(8000);
    c.cajas.set(30);
    f.detectChanges();
    const boton = f.nativeElement.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
    expect(texto(f.nativeElement)).toContain("Sobre el tope no se puede publicar");
    await c.enviar();
    ctrl.expectNone(`${API}/ofertas`);

    c.estado.set("borrador");
    f.detectChanges();
    expect(boton.disabled).toBeFalse();
    const p = c.enviar();
    const req = ctrl.expectOne(`${API}/ofertas`);
    expect(req.request.body).toEqual({ productoId: 10, precioUnitario: 8000, unidadesPorCaja: 12, cajasDisponibles: 30, plazoHoras: 24, modalidadEntrega: "ambos", estado: "borrador" });
    req.flush({ oferta: { id: 84, productoId: 10, precioUnitario: 8000, estado: "borrador" }, revisionPrecio: { casoId: 4, precioReferencia: 5490, topePct: 30, precioMaximo: 7137 } });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement)).toContain("Guardaste Crema para batir 35% MG como borrador");
    expect(texto(f.nativeElement)).toContain("el equipo de Cotizapp lo revisará");
  });

  it("publica con minimo y notas; un error del backend se explica", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.precio.set(5000);
    c.cajas.set(30);
    c.minimo.set(24);
    c.notas.set("  Caja cerrada  ");
    const p = c.enviar();
    const req = ctrl.expectOne(`${API}/ofertas`);
    expect(req.request.body).toEqual(jasmine.objectContaining({ minimoCompra: 24, notasCliente: "Caja cerrada", estado: "publicada" }));
    req.flush({ error: { code: "OFERTA_DUPLICADA" } }, { status: 409, statusText: "x" });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement)).toContain("Ya tienes una oferta para este producto.");
  });

  it("pide precio, unidades por caja y cajas", async () => {
    const f = await montar();
    await f.componentInstance.enviar();
    f.detectChanges();
    expect(texto(f.nativeElement)).toContain("Falta el precio, las cajas disponibles.");
  });
});
