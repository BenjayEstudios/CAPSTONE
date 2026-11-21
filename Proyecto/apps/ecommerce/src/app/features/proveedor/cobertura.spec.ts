import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { environment } from "../../../environments/environment";
import { CoberturaProveedor, PuntoRetiroProveedor } from "../../core/proveedor/panel-proveedor.service";
import { CoberturaProveedorComponent, nombreZona, textoDireccion } from "./cobertura.component";

const API = environment.apiUrl;
const COBERTURA: CoberturaProveedor = {
  horaCorte: "14:00", despachoGratisDesde: 150000, plazoEstandarHoras: 24, ofreceDespacho: true, ofreceRetiro: true,
  zonas: [
    { id: 7, comunaId: null, comuna: null, regionCodigo: "13", region: "Metropolitana de Santiago", costoDespacho: 4990, plazoHoras: 24 },
    { id: 8, comunaId: null, comuna: null, regionCodigo: "05", region: "Valparaíso", costoDespacho: 9990, plazoHoras: 72 },
    { id: 9, comunaId: 20, comuna: "Ñuñoa", regionCodigo: "13", region: "Metropolitana de Santiago", costoDespacho: 0, plazoHoras: null }
  ]
};
const DIR = { calle: "Av. Presidente Eduardo Frei Montalva", numero: "9650", complemento: "Bodega 12", comunaId: 25, comuna: "Quilicura", region: "Metropolitana de Santiago" };
const PUNTOS: PuntoRetiroProveedor[] = [
  { id: 1, nombre: "Bodega Quilicura", horario: "Lun a Vie 08:00-17:00", activo: true, usado: true, direccion: DIR },
  { id: 2, nombre: "Bodega vieja", horario: null, activo: false, usado: false, direccion: { ...DIR, calle: "Calle 2", numero: null, complemento: null } }
];
const REGIONES = [
  { codigo: "05", nombre: "Valparaíso", comunas: [{ id: 1, nombre: "Valparaíso" }] },
  { codigo: "13", nombre: "Metropolitana de Santiago", comunas: [{ id: 20, nombre: "Ñuñoa" }, { id: 25, nombre: "Quilicura" }] }
];

describe("Cobertura de despacho y puntos de retiro (KAN-109)", () => {
  let ctrl: HttpTestingController;

  async function montar() {
    TestBed.configureTestingModule({ imports: [CoberturaProveedorComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(CoberturaProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/proveedor/cobertura`).flush(COBERTURA);
    ctrl.expectOne(`${API}/proveedor/puntos-retiro`).flush({ items: PUNTOS });
    ctrl.expectOne(`${API}/proveedor/cobertura/regiones`).flush(REGIONES);
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();
  /** Tras una escritura, el componente recarga cobertura y puntos. */
  async function recarga(f: Awaited<ReturnType<typeof montar>>, cobertura = COBERTURA, puntos = PUNTOS) {
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${API}/proveedor/cobertura`).flush(cobertura);
    ctrl.expectOne(`${API}/proveedor/puntos-retiro`).flush({ items: puntos });
    await f.whenStable();
    f.detectChanges();
  }

  it("zonas agrupadas por region (norte a sur) con costo y plazo; puntos con su estado", async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll("tr.region")).map(texto)).toEqual(["Valparaíso", "Metropolitana de Santiago"]);
    const celdas = (tr: Element) => Array.from(tr.querySelectorAll("th, td")).slice(0, 3).map(texto);
    const filas = Array.from(el.querySelectorAll("tbody tr:not(.region)"));
    expect(celdas(filas[0]!)).toEqual(["Toda la región", "$9.990", "3 días"]);
    expect(celdas(filas[2]!)).toEqual(["Ñuñoa", "Gratis", "el de la oferta"]);
    const puntos = Array.from(el.querySelectorAll(".puntos li")).map(texto);
    expect(texto(el.querySelector(".puntos li .nombre")!)).toBe("Bodega Quilicura");
    expect(texto(el.querySelector(".puntos li .tag")!)).toBe("Activo");
    expect(puntos[0]).not.toContain("Borrar");
    expect(puntos[1]).toContain("Inactivo");
    expect(puntos[1]).toContain("Activar");
    expect(puntos[1]).toContain("Borrar");
  });

  it("agrega una zona por comuna y muestra el aviso", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.nuevaRegion = "13";
    c.nuevaComuna = 25;
    c.nuevoCosto = 2990;
    c.nuevoPlazo = 12;
    const p = c.agregarZona();
    const req = ctrl.expectOne(`${API}/proveedor/cobertura/zonas`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ comunaId: 25, regionCodigo: "13", costoDespacho: 2990, plazoHoras: 12 });
    req.flush({ id: 10 });
    await recarga(f);
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.ok"))).toContain("Agregaste Quilicura a tu cobertura.");
    expect(c.nuevaComuna).toBeNull();
  });

  it("una zona repetida muestra el error del backend", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.nuevaRegion = "13";
    c.nuevoCosto = 1;
    const p = c.agregarZona();
    ctrl.expectOne(`${API}/proveedor/cobertura/zonas`).flush({ error: { code: "ZONA_DUPLICADA" } }, { status: 409, statusText: "x" });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.error"))).toContain("Ya despachas a esa zona");
  });

  it("edita el costo de una zona y la quita", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.editarZona(COBERTURA.zonas[0]!);
    c.costoEdit = 3990;
    const p = c.guardarZona(COBERTURA.zonas[0]!);
    const req = ctrl.expectOne(`${API}/proveedor/cobertura/zonas/7`);
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual({ costoDespacho: 3990, plazoHoras: 24 });
    req.flush({});
    await recarga(f);
    await p;
    expect(c.editandoZona()).toBeNull();

    const b = c.borrarZona(COBERTURA.zonas[2]!);
    const del = ctrl.expectOne(`${API}/proveedor/cobertura/zonas/9`);
    expect(del.request.method).toBe("DELETE");
    del.flush(null);
    await recarga(f);
    await b;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.ok"))).toContain("Quitaste Ñuñoa de tu cobertura.");
  });

  it("puntos: crea uno nuevo, desactiva el activo y un 409 se explica", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.nuevoPunto();
    c.formPunto = { nombre: "Bodega Ñuñoa", horario: "", calle: "Pedro de Valdivia", numero: "100", complemento: "", comunaId: 20 };
    const p = c.guardarPunto();
    const req = ctrl.expectOne(`${API}/proveedor/puntos-retiro`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ nombre: "Bodega Ñuñoa", horario: null, direccion: { calle: "Pedro de Valdivia", numero: "100", complemento: null, comunaId: 20 } });
    req.flush({ id: 3 });
    await recarga(f);
    await p;
    expect(c.editandoPunto()).toBeNull();

    const d = c.cambiarActivo(PUNTOS[0]!);
    const r2 = ctrl.expectOne(`${API}/proveedor/puntos-retiro/1`);
    expect(r2.request.body).toEqual({ activo: false });
    r2.flush({ error: { code: "ULTIMO_PUNTO_RETIRO" } }, { status: 409, statusText: "x" });
    await d;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.error"))).toContain("Es tu único punto de retiro activo");
  });

  it("editar un punto manda solo lo que cambio", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.editarPunto(PUNTOS[0]!);
    c.formPunto.horario = "Lun a Sáb 08:00-14:00";
    const p = c.guardarPunto();
    const req = ctrl.expectOne(`${API}/proveedor/puntos-retiro/1`);
    expect(req.request.body).toEqual({ horario: "Lun a Sáb 08:00-14:00" });
    req.flush({});
    await recarga(f);
    await p;
  });

  it("textos", () => {
    expect(nombreZona({ comunaId: null, comuna: null })).toBe("Toda la región");
    expect(nombreZona({ comunaId: 20, comuna: "Ñuñoa" })).toBe("Ñuñoa");
    expect(textoDireccion(DIR)).toBe("Av. Presidente Eduardo Frei Montalva 9650, Bodega 12, Quilicura");
  });
});
