import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { DocumentoTributario, OrdenDetalle } from "../../core/models/checkout.models";
import { DetalleOrdenComponent, entregaEstimada, nombreDocumento, textoDireccion } from "./detalle-orden.component";

const API = environment.apiUrl;
const linea = (ofertaId: number, nombreProducto: string, cantidad: number, precioUnitario: number) => ({
  ofertaId, nombreProducto, formato: "Caja 1 L", precioUnitario, cantidad, totalLinea: cantidad * precioUnitario
});
const ORDEN: OrdenDetalle = {
  id: 7, codigo: "CM-10007", estado: "pagada", estadoPago: "pagado", medioPago: "tarjeta",
  creadaEn: "2026-09-23T13:30:00.000Z", pagadoEn: "2026-09-23T13:32:00.000Z", requiereFactura: false,
  subtotal: 164120, costoDespachoTotal: 5990, total: 170110,
  direccionEntrega: { calle: "Av. Irarrázaval", numero: "3450", complemento: "Local 2", referencia: "Entrada lateral", comunaNombre: "Ñuñoa", regionNombre: "RM" },
  envios: [
    { id: 13, proveedorId: 3, proveedorNombre: "Comercial Valle Central SpA", modalidad: "despacho", plazoHoras: 48, costoDespacho: 5990, subtotal: 112580, estado: "entregado",
      lineas: [linea(1, "Aceite vegetal", 4, 12890), linea(2, "Crema para batir", 6, 5190), linea(3, "Lentejas", 12, 2490)], puntoRetiro: null },
    { id: 14, proveedorId: 4, proveedorNombre: "Frigorífico del Sur S.A.", modalidad: "retiro", plazoHoras: 24, costoDespacho: 0, subtotal: 51540, estado: "por_despachar",
      lineas: [linea(4, "Queso mozzarella", 6, 8590)], puntoRetiro: { id: 2, nombre: "Planta Renca", horario: "Lun a Vie 07:30-16:00", direccion: "Av. Jorge Hirmas 2440, Renca" } }
  ]
};
const doc = (id: number, tipoDte: DocumentoTributario["tipoDte"], folio: number, ordenEnvioId: number | null, total: number): DocumentoTributario => ({
  id, tipoDte, tipoNombre: "X", folio, ordenId: 7, ordenEnvioId, total, emitidoEn: "", pdfUrl: `/documentos-tributarios/${id}/pdf`
});
const DOCS = [doc(28, 39, 1, null, 170110), doc(29, 52, 1007, 13, 118570), doc(30, 52, 1007, 14, 51540)];

describe("Detalle consolidado de la orden (KAN-96)", () => {
  function montar(orden: OrdenDetalle = ORDEN, documentos: DocumentoTributario[] = DOCS) {
    TestBed.configureTestingModule({ imports: [DetalleOrdenComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(DetalleOrdenComponent);
    f.componentRef.setInput("orden", orden);
    f.componentRef.setInput("documentos", documentos);
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ");

  it("folio, medio de pago, total pagado y la boleta de la orden", () => {
    const el = montar().nativeElement as HTMLElement;
    const resumen = texto(el.querySelector(".resumen-orden")!);
    expect(resumen).toContain("CM-10007");
    expect(resumen).toContain("Tarjeta / PayPal");
    expect(resumen).toContain("Total pagado$170.110");
    expect(resumen).toContain("Boleta electrónica N.º 1 (PDF)");
  });

  it("por distribuidor: lineas, modalidad con direccion o punto de retiro, plazo, estado y su guia", () => {
    const el = montar().nativeElement as HTMLElement;
    const [despacho, retiro] = Array.from(el.querySelectorAll("article.envio")).map(texto);
    expect(despacho).toContain("Despacho a domicilio");
    expect(despacho).toContain("Av. Irarrázaval 3450, Local 2, Ñuñoa · Entrada lateral");
    expect(despacho).toContain("Plazo 48 h · Llega a más tardar el");
    expect(despacho).toContain("Entregado");
    expect(despacho).toContain("Aceite vegetal");
    expect(despacho).toContain("Total de este distribuidor$118.570");
    expect(despacho).toContain("Guía de despacho N.º 1007 (PDF)");
    expect(retiro).toContain("Retiro en Planta Renca");
    expect(retiro).toContain("Av. Jorge Hirmas 2440, Renca · Lun a Vie 07:30-16:00");
    expect(retiro).toContain("Listo para retirar a más tardar el");
    expect(retiro).toContain("RetiroSin costo");
    expect(retiro).toContain("Por despachar");
  });

  it("sin pago: la boleta se emite al confirmar y el plazo corre desde el pago", () => {
    const el = montar({ ...ORDEN, estado: "pendiente_pago", estadoPago: "fallido", pagadoEn: null }, []).nativeElement as HTMLElement;
    expect(texto(el)).toContain("La boleta se emite cuando se confirma el pago.");
    expect(texto(el)).toContain("El plazo corre desde que se confirma el pago");
    expect(texto(el)).not.toContain("Total pagado");
  });

  it("abre el PDF con el token (blob) en otra pestana", async () => {
    const f = montar();
    const ctrl = TestBed.inject(HttpTestingController);
    const abrir = spyOn(window, "open").and.returnValue(null);
    spyOn(URL, "createObjectURL").and.returnValue("blob:pdf");
    const p = f.componentInstance.abrirPdf(DOCS[0]!);
    const req = ctrl.expectOne(`${API}/documentos-tributarios/28/pdf`);
    expect(req.request.responseType).toBe("blob");
    req.flush(new Blob(["%PDF"], { type: "application/pdf" }));
    await p;
    expect(abrir).toHaveBeenCalledWith("blob:pdf", "_blank", "noopener");
  });

  it("helpers: direccion, nombre del documento y fecha estimada", () => {
    expect(textoDireccion({ calle: "Av. Providencia", numero: null, complemento: null, referencia: null, comunaNombre: "Providencia", regionNombre: "RM" })).toBe("Av. Providencia, Providencia");
    expect(nombreDocumento({ tipoDte: 33, tipoNombre: "FACTURA", folio: 5 })).toBe("Factura electrónica N.º 5");
    expect(entregaEstimada({ pagadoEn: "2026-11-20T12:00:00.000Z" }, { plazoHoras: 24 })?.toISOString()).toBe("2026-11-21T12:00:00.000Z");
    expect(entregaEstimada({ pagadoEn: null }, { plazoHoras: 24 })).toBeNull();
  });
});
