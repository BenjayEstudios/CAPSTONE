import { DOCUMENT } from "@angular/common";
import { Component, computed, inject, input, signal } from "@angular/core";
import { CheckoutService } from "../../core/checkout/checkout.service";
import { DireccionEntrega, DocumentoTributario, EnvioOrden, MedioPago, OrdenDetalle } from "../../core/models/checkout.models";
import { formatearClp, plazo } from "../../shared/formato";
import { estadoEnvio, PasoSeguimiento, pasosEnvio } from "./estados";

const MEDIOS: Record<MedioPago, string> = {
  tarjeta: "Tarjeta (Webpay)",
  transferencia: "Transferencia bancaria",
  linea_credito: "Línea de crédito Cotizapp"
};

const NOMBRES_DTE: Record<number, string> = {
  33: "Factura electrónica",
  39: "Boleta electrónica",
  52: "Guía de despacho",
  61: "Nota de crédito"
};

/** "Boleta electrónica N.º 1" */
export function nombreDocumento(d: Pick<DocumentoTributario, "tipoDte" | "tipoNombre" | "folio">): string {
  return `${NOMBRES_DTE[d.tipoDte] ?? d.tipoNombre} N.º ${d.folio}`;
}

const fechaCorta =new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" });
const fechaHora = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "Av. Irarrázaval 3450, Local 2, Ñuñoa" */
export function textoDireccion(d: DireccionEntrega): string {
  return [[d.calle, d.numero].filter(Boolean).join(" "), d.complemento, d.comunaNombre].filter(Boolean).join(", ");
}

/** Fecha estimada de entrega: pago + plazo del envio. Sin pago todavia no hay fecha. */
export function entregaEstimada(o: Pick<OrdenDetalle, "pagadoEn">, e: Pick<EnvioOrden, "plazoHoras">): Date | null {
  if (e.plazoHoras === null || !o.pagadoEn) return null;
  const desde = new Date(o.pagadoEn);
  if (Number.isNaN(desde.getTime())) return null;
  return new Date(desde.getTime() + e.plazoHoras * 3600_000);
}

// Detalle consolidado de una orden (KAN-96): folio, medio de pago y totales,
// y por cada distribuidor sus lineas, modalidad (despacho o retiro, con el
// punto), plazo y estado, con los documentos tributarios. Lo usa el resultado
// del pago y lo puede usar "Mis pedidos" (KAN-98).
@Component({
  selector: "app-detalle-orden",
  standalone: true,
  templateUrl: "./detalle-orden.component.html",
  styleUrl: "./detalle-orden.component.css"
})
export class DetalleOrdenComponent {
  private readonly checkout = inject(CheckoutService);
  private readonly document = inject(DOCUMENT);

  readonly orden = input.required<OrdenDetalle>();
  readonly documentos = input<DocumentoTributario[]>([]);

  readonly descargando = signal<number | null>(null);
  readonly errorPdf = signal<string | null>(null);

  readonly clp = formatearClp;
  readonly plazo = plazo;
  readonly textoDireccion = textoDireccion;
  readonly nombreDocumento = nombreDocumento;

  /** Boleta o factura de la orden (sin envio asociado). */
  readonly comprobantes = computed(() => this.documentos().filter((d) => d.ordenEnvioId === null && (d.tipoDte === 33 || d.tipoDte === 39)));

  medio(m: MedioPago | null): string {
    return m ? MEDIOS[m] : "—";
  }

  estadoEnvio(e: EnvioOrden): string {
    return estadoEnvio(e.estado);
  }

  /** Seguimiento del envio (KAN-98); solo cuando la orden ya esta pagada. */
  pasos(e: EnvioOrden): PasoSeguimiento[] {
    return this.orden().estadoPago === "pagado" ? pasosEnvio(e) : [];
  }

  guiasDe(e: EnvioOrden): DocumentoTributario[] {
    return this.documentos().filter((d) => d.ordenEnvioId === e.id);
  }

  fecha(iso: string | null): string {
    return iso ? fechaHora.format(new Date(iso)) : "—";
  }

  /** "Llega a más tardar el lunes 23 de noviembre" o plazo a convenir. */
  llegada(e: EnvioOrden): string {
    if (e.plazoHoras === null) return "Plazo a convenir con el distribuidor";
    const f = entregaEstimada(this.orden(), e);
    if (!f) return "El plazo corre desde que se confirma el pago";
    return `${e.modalidad === "retiro" ? "Listo para retirar" : "Llega"} a más tardar el ${fechaCorta.format(f)}`;
  }

  async abrirPdf(d: DocumentoTributario): Promise<void> {
    if (this.descargando() !== null) return;
    this.descargando.set(d.id);
    this.errorPdf.set(null);
    try {
      const blob = await this.checkout.pdf(d.id);
      const url = URL.createObjectURL(blob);
      this.document.defaultView?.open(url, "_blank", "noopener");
      // El navegador ya abrio el PDF; la URL se libera un rato despues.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.errorPdf.set("No pudimos abrir el documento. Inténtalo de nuevo.");
    } finally {
      this.descargando.set(null);
    }
  }
}
