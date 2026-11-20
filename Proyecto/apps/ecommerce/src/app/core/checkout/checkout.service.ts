import { DOCUMENT } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";
import {
  Comuna,
  ConfirmarCarroRequest,
  MedioPago,
  OpcionesEntrega,
  OrdenCreada,
  OrdenDetalle,
  PagoIniciado
} from "../models/checkout.models";

// Llamadas del checkout (KAN-95). El pago va por Webpay Plus: el backend crea
// la transaccion y el navegador envia token_ws a la URL de Webpay con un
// formulario POST (asi lo pide Transbank).
@Injectable({ providedIn: "root" })
export class CheckoutService {
  private readonly api = inject(ApiClient);
  private comunasCache: Promise<Comuna[]> | null = null;

  opcionesEntrega(): Promise<OpcionesEntrega> {
    return firstValueFrom(this.api.get<OpcionesEntrega>("/carro/opciones-entrega"));
  }

  comunas(): Promise<Comuna[]> {
    this.comunasCache ??= firstValueFrom(this.api.get<Comuna[]>("/comunas")).catch((e) => {
      this.comunasCache = null;
      throw e;
    });
    return this.comunasCache;
  }

  confirmar(body: ConfirmarCarroRequest): Promise<OrdenCreada> {
    return firstValueFrom(this.api.post<OrdenCreada>("/carro/confirmar", body));
  }

  iniciarPago(ordenId: number, medioPago: MedioPago = "tarjeta"): Promise<PagoIniciado> {
    return firstValueFrom(this.api.post<PagoIniciado>(`/ordenes/${ordenId}/pago`, { medioPago }));
  }

  orden(id: number): Promise<OrdenDetalle> {
    return firstValueFrom(this.api.get<OrdenDetalle>(`/ordenes/${id}`));
  }
}

// Envia al comprador a la pasarela. Aparte para poder reemplazarlo en los tests.
@Injectable({ providedIn: "root" })
export class NavegadorPasarela {
  private readonly document = inject(DOCUMENT);

  ir(url: string, token: string): void {
    const form = this.document.createElement("form");
    form.method = "POST";
    form.action = url;
    const input = this.document.createElement("input");
    input.type = "hidden";
    input.name = "token_ws";
    input.value = token;
    form.appendChild(input);
    this.document.body.appendChild(form);
    form.submit();
  }
}
