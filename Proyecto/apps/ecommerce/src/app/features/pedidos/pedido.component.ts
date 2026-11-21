import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CheckoutService, NavegadorPasarela } from "../../core/checkout/checkout.service";
import { DocumentoTributario, OrdenDetalle } from "../../core/models/checkout.models";
import { formatearClp } from "../../shared/formato";
import { DetalleOrdenComponent } from "./detalle-orden.component";
import { estadoOrden, tonoOrden } from "./estados";

// /pedidos/:id (KAN-98): detalle de una orden del comprador con el
// seguimiento de cada envio y la descarga de la boleta o factura. Si sigue
// pendiente de pago, se puede pagar desde aqui.
@Component({
  selector: "app-pedido",
  standalone: true,
  imports: [RouterLink, DetalleOrdenComponent],
  templateUrl: "./pedido.component.html",
  styleUrl: "./pedidos.component.css"
})
export class PedidoComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly checkout = inject(CheckoutService);
  private readonly pasarela = inject(NavegadorPasarela);
  private readonly params = toSignal(this.ruta.paramMap, { requireSync: true });

  readonly id = computed(() => Number(this.params().get("id")));
  readonly orden = signal<OrdenDetalle | null>(null);
  readonly documentos = signal<DocumentoTributario[]>([]);
  readonly estado = signal<"cargando" | "ok" | "no-encontrada" | "error">("cargando");
  readonly pagando = signal(false);
  readonly errorPago = signal<string | null>(null);

  readonly clp = formatearClp;
  readonly estadoOrden = estadoOrden;
  readonly tonoOrden = tonoOrden;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.cargar(id));
    });
  }

  async cargar(id = this.id()): Promise<void> {
    this.estado.set("cargando");
    try {
      const o = await this.checkout.orden(id);
      this.orden.set(o);
      this.documentos.set([]);
      this.estado.set("ok");
      // Los documentos llegan despues, sin atrasar el detalle.
      if (o.estadoPago === "pagado") this.documentos.set(await this.checkout.documentos(id).catch(() => []));
    } catch (err) {
      this.estado.set(err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400) ? "no-encontrada" : "error");
    }
  }

  async pagar(): Promise<void> {
    const o = this.orden();
    if (!o || this.pagando()) return;
    this.pagando.set(true);
    this.errorPago.set(null);
    try {
      const pago = await this.checkout.iniciarPago(o.id, "tarjeta");
      this.pasarela.ir(pago.urlPago, pago.token);
    } catch {
      this.pagando.set(false);
      this.errorPago.set("No pudimos conectar con Webpay. Inténtalo en unos minutos.");
    }
  }
}
