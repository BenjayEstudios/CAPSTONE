import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { RELOJ } from "../../core/reloj";
import { DocumentoExigido } from "../../core/proveedor/panel-proveedor.service";
import { DocumentosProveedorComponent, textoRevision, textoVigencia } from "./documentos.component";

const API = environment.apiUrl;
const HOY = new Date("2026-11-20T15:00:00Z");
const DOCS: DocumentoExigido[] = [
  {
    tipo: "carpeta_tributaria", nombre: "Carpeta tributaria", requiereVencimiento: false, estado: "al_dia", anteriores: 0,
    actual: { id: 1, url: "http://x/1.pdf", venceEn: null, vigencia: "al_dia", diasParaVencer: null, revisionEstado: "aprobado", motivoRechazo: null, revisadoEn: null }
  },
  {
    tipo: "resolucion_sanitaria", nombre: "Resolución sanitaria", requiereVencimiento: true, estado: "por_vencer", anteriores: 1,
    actual: { id: 3, url: "http://x/3.pdf", venceEn: "2026-12-08", vigencia: "por_vencer", diasParaVencer: 18, revisionEstado: "pendiente", motivoRechazo: null, revisadoEn: null }
  },
  { tipo: "vigencia", nombre: "Certificado de vigencia", requiereVencimiento: true, estado: "falta", anteriores: 0, actual: null }
];

describe("Documentos del proveedor (KAN-110)", () => {
  let ctrl: HttpTestingController;

  async function montar() {
    TestBed.configureTestingModule({
      imports: [DocumentosProveedorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: RELOJ, useValue: () => HOY }]
    });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(DocumentosProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/proveedor/documentos`).flush({ items: DOCS });
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();
  const pdf = () => new File(["%PDF-1.4"], "vigencia.pdf", { type: "application/pdf" });

  it("los tres documentos con su estado, fecha de vencimiento y revision", async () => {
    const el = (await montar()).nativeElement as HTMLElement;
    const items = Array.from(el.querySelectorAll(".documentos > li"));
    expect(items.map((li) => texto(li.querySelector("h3")!))).toEqual(["Carpeta tributaria", "Resolución sanitaria", "Certificado de vigencia"]);
    expect(texto(items[0]!.querySelector(".tag")!)).toBe("Al día");
    expect(texto(items[0]!)).toContain("Sin fecha de vencimiento");
    expect(texto(items[0]!)).toContain("Aprobado");
    expect(texto(items[1]!.querySelector(".tag")!)).toBe("Vence en 18 días");
    expect(texto(items[1]!)).toContain("Vence el 8 de diciembre de 2026");
    expect(texto(items[1]!)).toContain("Pendiente de revisión del equipo de Cotizapp");
    expect(texto(items[1]!)).toContain("1 versión anterior");
    expect(texto(items[2]!.querySelector(".tag")!)).toBe("Falta");
    expect(texto(items[2]!)).toContain("Todavía no lo subes.");
  });

  it("sube el archivo con tipo y vencimiento, avisa que queda pendiente y recarga", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.abrir("vigencia");
    c.subidas.vigencia = { archivo: pdf(), venceEn: "2027-01-10" };
    const p = c.subir(DOCS[2]!);
    const req = ctrl.expectOne(`${API}/proveedor/documentos?tipo=vigencia&venceEn=2027-01-10`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get("archivo")).toBeInstanceOf(File);
    req.flush({ id: 9, tipo: "vigencia", nombre: "Certificado de vigencia", revisionEstado: "pendiente" });
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${API}/proveedor/documentos`).flush({ items: DOCS });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.ok"))).toContain("Recibimos tu certificado de vigencia. Queda pendiente de revisión");
    expect(c.abierto()).toBeNull();
  });

  it("no sube sin archivo ni con un vencimiento pasado; un error del backend se muestra en su documento", async () => {
    const f = await montar();
    const c = f.componentInstance;
    await c.subir(DOCS[2]!);
    expect(c.error()).toEqual({ tipo: "vigencia", texto: "Elige el archivo." });
    c.subidas.vigencia = { archivo: pdf(), venceEn: "" };
    await c.subir(DOCS[2]!);
    expect(c.error()?.texto).toBe("Indica la fecha de vencimiento.");
    c.subidas.vigencia.venceEn = "2026-11-01";
    await c.subir(DOCS[2]!);
    expect(c.error()?.texto).toContain("ya pasó");
    ctrl.expectNone(`${API}/proveedor/documentos?tipo=vigencia&venceEn=2026-11-01`);

    c.subidas.carpeta_tributaria = { archivo: new File(["hola"], "a.txt"), venceEn: "" };
    const p = c.subir(DOCS[0]!);
    ctrl.expectOne(`${API}/proveedor/documentos?tipo=carpeta_tributaria`).flush({ error: { code: "FORMATO_NO_SOPORTADO" } }, { status: 400, statusText: "x" });
    await p;
    f.detectChanges();
    expect(c.error()).toEqual({ tipo: "carpeta_tributaria", texto: "Solo se aceptan archivos PDF, JPG o PNG." });
    expect(texto(f.nativeElement.querySelectorAll(".documentos > li")[0])).toContain("Solo se aceptan archivos PDF, JPG o PNG.");
  });

  it("textos", () => {
    expect(textoVigencia({ estado: "por_vencer", actual: { ...DOCS[1]!.actual!, diasParaVencer: 1 } }).texto).toBe("Vence en 1 día");
    expect(textoVigencia({ estado: "vencido", actual: null })).toEqual({ texto: "Vencido", tono: "alerta" });
    expect(textoRevision({ ...DOCS[0]!.actual!, revisionEstado: "rechazado", motivoRechazo: "Ilegible" })).toBe("Rechazado: Ilegible. Sube uno nuevo.");
  });
});
