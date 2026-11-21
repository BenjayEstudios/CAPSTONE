import { Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CheckoutService, NavegadorPasarela } from "../../core/checkout/checkout.service";
import { DocumentoTributario, OrdenDetalle, ResultadoPago } from "../../core/models/checkout.models";
import { CarroState } from "../../core/state/carro.state";
import { formatearClp } from "../../shared/formato";
import { DetalleOrdenComponent } from "../pedidos/detalle-orden.component";

const TITULOS: Record<Exclude<ResultadoPago, "aprobado">, string> = {
  rechazado: "El pago fue rechazado",
  anulado: "Anulaste el pago",
  error: "No pudimos confirmar el pago"
};

// /checkout/resultado?orden=&pago= (KAN-95): adonde vuelve el comprador desde
// Webpay (el backend redirige aqui). Lee la orden para mostrar el estado real
// (no confia solo en ?pago=) y, si sigue pendiente, permite reintentar.
// Debajo va el detalle consolidado de la compra con sus documentos (KAN-96).
@Component({
  selector: "app-resultado-pago",
  standalone: true,
  imports: [RouterLink, DetalleOrdenComponent],
  templateUrl: "./resultado.component.html",
  styleUrl: "./checkout.component.css"
})
export class ResultadoPagoComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly checkout = inject(CheckoutService);
  private readonly pasarela = inject(NavegadorPasarela);
  private readonly carro = inject(CarroState);
  private readonly query = toSignal(this.ruta.queryParamMap, { requireSync: true });

  readonly ordenId = computed(() => Number(this.query().get("orden")) || null);
  readonly pago = computed(() => (this.query().get("pago") ?? "error") as ResultadoPago);
  readonly orden = signal<OrdenDetalle | null>(null);
  readonly documentos = signal<DocumentoTributario[]>([]);
  readonly estado = signal<"cargando" | "ok" | "no-encontrada">("cargando");
  readonly reintentando = signal(false);
  readonly errorReintento = signal<string | null>(null);

  readonly pagada = computed(() => this.orden()?.estadoPago === "pagado");
  readonly titulo = computed(() => {
    if (this.pagada()) return "¡Listo! Tu pago fue aprobado";
    const p = this.pago();
    return p === "aprobado" ? TITULOS.error : TITULOS[p] ?? TITULOS.error;
  });

  readonly clp = formatearClp;

  constructor() {
    void this.carro.recargar();
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    const id = this.ordenId();
    if (!id) return this.estado.set("no-encontrada");
    try {
      const o = await this.checkout.orden(id);
      this.orden.set(o);
      this.estado.set("ok");
      // La boleta o factura y las guias se emiten al confirmar el pago.
      if (o.estadoPago === "pagado") this.documentos.set(await this.checkout.documentos(id).catch(() => []));
    } catch {
      this.estado.set("no-encontrada");
    }
  }

  async reintentar(): Promise<void> {
    const o = this.orden();
    if (!o || this.reintentando()) return;
    this.reintentando.set(true);
    this.errorReintento.set(null);
    try {
      const pago = await this.checkout.iniciarPago(o.id, "tarjeta");
      this.pasarela.ir(pago.urlPago, pago.token, pago.metodo);
    } catch {
      this.reintentando.set(false);
      this.errorReintento.set("No pudimos conectar con la pasarela de pago. Inténtalo en unos minutos.");
    }
  }
}
