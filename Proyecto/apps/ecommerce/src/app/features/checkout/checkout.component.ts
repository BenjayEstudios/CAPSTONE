import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { CheckoutService, NavegadorPasarela } from "../../core/checkout/checkout.service";
import { Comuna, ConfirmarCarroRequest, DireccionGuardada, MedioPago, OpcionesEntrega, PuntoRetiro } from "../../core/models/checkout.models";
import { CarroState } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { formatearClp, plazo } from "../../shared/formato";
import { armarCarro, GrupoCarro } from "../carro/carro.calculo";
import { FichasDelCarro } from "../carro/fichas-del-carro";

/** Como llega cada distribuidor: a la direccion, o retiro en uno de sus puntos. */
export type EntregaGrupo = { tipo: "despacho" } | { tipo: "retiro"; puntoRetiroId: number };

interface ErrorApi {
  error?: { code?: string; detalle?: { proveedorId?: number; proveedores?: Array<{ proveedorId: number }> } };
}

// /checkout (KAN-95): pago unico del carro multiproveedor, en tres pasos
// (quien compra, entrega, medio de pago) con el resumen "Asi llega tu pedido".
// Pagar crea la orden (POST /carro/confirmar), inicia la transaccion en Webpay
// (POST /ordenes/:id/pago) y envia al comprador a Webpay; al volver, el
// backend redirige a /checkout/resultado.
@Component({
  selector: "app-checkout",
  standalone: true,
  imports: [FormsModule, RouterLink],
  providers: [FichasDelCarro],
  templateUrl: "./checkout.component.html",
  styleUrl: "./checkout.component.css"
})
export class CheckoutComponent {
  readonly carro = inject(CarroState);
  readonly session = inject(SessionState);
  private readonly fichas = inject(FichasDelCarro).fichas;
  private readonly checkout = inject(CheckoutService);
  private readonly pasarela = inject(NavegadorPasarela);
  private readonly router = inject(Router);

  readonly opciones = signal<OpcionesEntrega | null>(null);
  readonly comunas = signal<Comuna[]>([]);

  // Paso 1
  readonly documento = signal<"boleta" | "factura">("boleta");
  // Paso 2
  readonly direccionElegida = signal<number | "nueva" | null>(null);
  readonly nueva = { calle: "", numero: "", complemento: "", comunaId: null as number | null, referencia: "" };
  readonly entregas = signal<ReadonlyMap<number, EntregaGrupo>>(new Map());
  // Paso 3
  readonly medioPago = signal<MedioPago>("tarjeta");

  readonly enviando = signal(false);
  readonly error = signal<{ texto: string; alCarro?: boolean } | null>(null);
  readonly intentado = signal(false);

  readonly resumen = computed(() => armarCarro(this.carro.items(), this.fichas()));
  readonly grupos = computed(() => this.resumen().grupos);

  readonly clp = formatearClp;
  readonly plazo = plazo;

  constructor() {
    void this.carro.recargar();
    void this.cargarOpciones();
  }

  private async cargarOpciones(): Promise<void> {
    try {
      const o = await this.checkout.opcionesEntrega();
      this.opciones.set(o);
      this.direccionElegida.set(o.direcciones[0]?.id ?? "nueva");
      if (!o.direcciones.length) void this.cargarComunas();
    } catch {
      this.opciones.set({ direcciones: [], puntosRetiro: [] });
      this.direccionElegida.set("nueva");
      void this.cargarComunas();
    }
  }

  async cargarComunas(): Promise<void> {
    if (this.comunas().length) return;
    try {
      this.comunas.set(await this.checkout.comunas());
    } catch {
      this.error.set({ texto: "No pudimos cargar las comunas. Recarga la página." });
    }
  }

  elegirDireccion(v: number | "nueva"): void {
    this.direccionElegida.set(v);
    if (v === "nueva") void this.cargarComunas();
  }

  /** Puntos de retiro del distribuidor, si todas sus ofertas aceptan retiro. */
  puntosDe(g: GrupoCarro): PuntoRetiro[] {
    const ofertas = this.ofertasDe(g);
    if (ofertas.some((o) => o.modalidadEntrega === "despacho")) return [];
    return (this.opciones()?.puntosRetiro ?? []).filter((p) => p.proveedorId === g.proveedorId);
  }

  /** Despacha si ninguna de sus ofertas es solo retiro. */
  puedeDespachar(g: GrupoCarro): boolean {
    return !this.ofertasDe(g).some((o) => o.modalidadEntrega === "retiro");
  }

  private ofertasDe(g: GrupoCarro) {
    const ids = g.lineas.map((l) => l.ofertaId);
    return [...this.fichas().values()].flatMap((f) => f.ofertas).filter((o) => ids.includes(o.id));
  }

  /** Lo elegido para el grupo; por defecto despacho, o el primer punto si solo hay retiro. */
  entregaDe(g: GrupoCarro): EntregaGrupo | null {
    const elegida = this.entregas().get(g.proveedorId!);
    if (elegida) return elegida;
    if (this.puedeDespachar(g)) return { tipo: "despacho" };
    const p = this.puntosDe(g)[0];
    return p ? { tipo: "retiro", puntoRetiroId: p.id } : null;
  }

  elegirEntrega(g: GrupoCarro, e: EntregaGrupo): void {
    const m = new Map(this.entregas());
    m.set(g.proveedorId!, e);
    this.entregas.set(m);
  }

  esRetiro(g: GrupoCarro, puntoId: number): boolean {
    const e = this.entregaDe(g);
    return e?.tipo === "retiro" && e.puntoRetiroId === puntoId;
  }

  readonly hayDespacho = computed(() => this.grupos().some((g) => this.entregaDe(g)?.tipo === "despacho"));

  /** Despacho estimado (la tarifa a la comuna de la cuenta); el backend calcula el definitivo. */
  despachoDe(g: GrupoCarro): number {
    return this.entregaDe(g)?.tipo === "despacho" ? g.despacho.costo : 0;
  }

  readonly despachos = computed(() => this.grupos().reduce((s, g) => s + this.despachoDe(g), 0));
  readonly total = computed(() => this.resumen().subtotal + this.despachos());

  /** "3 productos" */
  productos(g: GrupoCarro): string {
    return `${g.lineas.length} ${g.lineas.length === 1 ? "producto" : "productos"}`;
  }

  /** "Av. Irarrázaval 3450, Local 2" */
  textoDireccion(d: DireccionGuardada): string {
    return [[d.calle, d.numero].filter(Boolean).join(" "), d.complemento].filter(Boolean).join(", ");
  }

  nombrePunto(id: number): string {
    return this.opciones()?.puntosRetiro.find((p) => p.id === id)?.nombre ?? "su bodega";
  }

  private faltaDireccion(): boolean {
    if (!this.hayDespacho()) return false;
    const d = this.direccionElegida();
    if (d === null) return true;
    if (d !== "nueva") return false;
    return !this.nueva.calle.trim() || !this.nueva.comunaId;
  }

  readonly sinEntrega = computed(() => this.grupos().some((g) => this.entregaDe(g) === null));

  private armarSolicitud(): ConfirmarCarroRequest {
    const retiros = this.grupos()
      .map((g) => ({ g, e: this.entregaDe(g) }))
      .filter((x): x is { g: GrupoCarro; e: { tipo: "retiro"; puntoRetiroId: number } } => x.e?.tipo === "retiro")
      .map(({ g, e }) => ({ proveedorId: g.proveedorId!, puntoRetiroId: e.puntoRetiroId }));
    const body: ConfirmarCarroRequest = { retiros, requiereFactura: this.documento() === "factura" };
    if (this.hayDespacho()) {
      const d = this.direccionElegida();
      if (d === "nueva") {
        const n = this.nueva;
        body.direccion = {
          comunaId: n.comunaId!,
          calle: n.calle.trim(),
          ...(n.numero.trim() ? { numero: n.numero.trim() } : {}),
          ...(n.complemento.trim() ? { complemento: n.complemento.trim() } : {}),
          ...(n.referencia.trim() ? { referencia: n.referencia.trim() } : {})
        };
      } else if (d !== null) body.direccionId = d;
    }
    return body;
  }

  async pagar(): Promise<void> {
    this.intentado.set(true);
    this.error.set(null);
    if (this.resumen().bloqueos.length) {
      this.error.set({ texto: "Hay cosas por resolver en tu carro antes de pagar.", alCarro: true });
      return;
    }
    if (this.sinEntrega()) {
      this.error.set({ texto: "Hay un distribuidor sin forma de entrega disponible. Quítalo del carro para continuar.", alCarro: true });
      return;
    }
    if (this.faltaDireccion()) {
      this.error.set({ texto: "Indica la dirección de despacho: calle y comuna." });
      return;
    }
    if (this.medioPago() !== "tarjeta") return;

    this.enviando.set(true);
    let ordenId: number | null = null;
    try {
      const orden = await this.checkout.confirmar(this.armarSolicitud());
      ordenId = orden.ordenId;
      const pago = await this.checkout.iniciarPago(orden.ordenId, "tarjeta");
      // El carro ya quedo convertido en orden: la cabecera debe mostrarlo vacio.
      void this.carro.recargar();
      this.pasarela.ir(pago.urlPago, pago.token);
    } catch (err) {
      this.enviando.set(false);
      if (ordenId !== null) {
        // La orden quedo creada pero no se pudo iniciar el pago: se reintenta desde el resultado.
        void this.carro.recargar();
        void this.router.navigate(["/checkout/resultado"], { queryParams: { orden: ordenId, pago: "error" } });
        return;
      }
      this.error.set(this.mensajeError(err));
      if (this.error()?.alCarro) void this.carro.recargar();
    }
  }

  private mensajeError(err: unknown): { texto: string; alCarro?: boolean } {
    const e = err instanceof HttpErrorResponse ? (err.error as ErrorApi | null)?.error : undefined;
    const nombre = (id?: number) => this.grupos().find((g) => g.proveedorId === id)?.nombre ?? "Un distribuidor";
    switch (e?.code) {
      case "PRECIO_CAMBIO":
      case "MINIMO_COMPRA":
      case "SIN_STOCK":
      case "OFERTA_NO_DISPONIBLE":
      case "CARRO_VACIO":
        return { texto: "Tu carro cambió (precios, stock o disponibilidad). Revísalo antes de pagar.", alCarro: true };
      case "SIN_COBERTURA": {
        const ids = e.detalle?.proveedores?.map((p) => p.proveedorId) ?? [];
        const quienes = ids.length ? ids.map((id) => nombre(id)).join(", ") : "Un distribuidor";
        return { texto: `${quienes} no despacha a esa comuna. Elige retiro en su bodega u otra dirección.` };
      }
      case "RETIRO_NO_DISPONIBLE":
        return { texto: `${nombre(e.detalle?.proveedorId)} no permite retiro para este pedido. Elige despacho.` };
      case "MODALIDAD_NO_DISPONIBLE":
        return { texto: `${nombre(e.detalle?.proveedorId)} no despacha este pedido. Elige retiro en su bodega.` };
      case "PROVEEDOR_NO_DISPONIBLE":
        return { texto: `${nombre(e.detalle?.proveedorId)} no está recibiendo pedidos. Quítalo del carro para continuar.`, alCarro: true };
      case "DIRECCION_REQUERIDA":
      case "VALIDACION":
        return { texto: "Revisa la dirección de despacho: calle y comuna." };
      default:
        return { texto: "No pudimos iniciar el pago. Inténtalo de nuevo." };
    }
  }
}
