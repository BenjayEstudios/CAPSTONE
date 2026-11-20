import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ApiClient } from "../api/api.client";

const SESION_KEY = "cotizapp.analitica.sesion";

/** Identificador anonimo de la visita (dura lo que la pestaña), para agrupar eventos. */
function sesionId(): string {
  try {
    const guardado = sessionStorage.getItem(SESION_KEY);
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    sessionStorage.setItem(SESION_KEY, nuevo);
    return nuevo;
  } catch {
    return crypto.randomUUID();
  }
}

// Eventos de analitica del comprador (POST /eventos/lote, publico). Los usa
// la analitica del proveedor y el reporte de busquedas sin resultados. Si el
// envio falla se ignora: nunca debe romper la navegacion.
@Injectable({ providedIn: "root" })
export class AnaliticaService {
  private readonly api = inject(ApiClient);
  private readonly sesion = sesionId();

  /** KAN-91: cada busqueda con su cantidad de resultados (las de 0 alimentan "busquedas sin resultados"). */
  busqueda(termino: string, resultados: number): void {
    void this.enviar({ tipo_evento: "busqueda", termino, resultados: Math.min(resultados, 65535) });
  }

  private async enviar(evento: Record<string, unknown>): Promise<void> {
    try {
      await firstValueFrom(this.api.post("/eventos/lote", { eventos: [{ ...evento, sesion_id: this.sesion }] }));
    } catch {
      // Sin consecuencias para la persona.
    }
  }
}
