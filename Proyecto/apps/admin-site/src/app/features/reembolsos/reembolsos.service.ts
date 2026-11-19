import { HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { CrearReembolsoBody, ReembolsoCreado, ResumenReembolsos } from "../../core/models/reembolsos.models";

@Injectable({ providedIn: "root" })
export class ReembolsosService {
  private readonly api = inject(ApiClient);

  buscar(codigo: string) {
    return this.api.get<ResumenReembolsos>(`/reembolsos/buscar?${new HttpParams().set("codigo", codigo.trim()).toString()}`);
  }
  crear(ordenId: number, body: CrearReembolsoBody) {
    return this.api.post<ReembolsoCreado>(`/ordenes/${ordenId}/reembolsos`, body);
  }
  /** Descarga el PDF (requiere el token Bearer, por eso no es un enlace directo). */
  pdf(pdfUrl: string) {
    return this.api.getBlob(pdfUrl);
  }
}
