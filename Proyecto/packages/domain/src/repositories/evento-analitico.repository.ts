import type { EventoOrigen, EventoTipo } from "../entities/evento-analitico.entity.js";

export interface NuevoEventoAnalitico {
  tipoEvento: EventoTipo;
  sesionId: string;
  usuarioId: number | null;
  productoId: number | null;
  ofertaId: number | null;
  comunaId: number | null;
  origen: EventoOrigen | null;
  convirtio: boolean | null;
  termino: string | null;
  resultados: number | null;
}

/** desde inclusivo, hastaExclusivo exclusivo (medianoche UTC). */
export interface RangoFechas {
  desde: Date;
  hastaExclusivo: Date;
}

export interface ConteoDia {
  fecha: string; // yyyy-mm-dd
  tipo: EventoTipo;
  total: number;
}
export interface ConteoOfertaDia {
  ofertaId: number;
  productoId: number;
  producto: string;
  fecha: string;
  tipo: "vista_producto" | "click_oferta";
  total: number;
}

// Puerto de eventos analiticos: escritura liviana + agregaciones de solo lectura.
// Nunca expone sesion_id ni usuario_id en las lecturas.
export interface EventoAnaliticoRepository {
  registrar(eventos: NuevoEventoAnalitico[]): Promise<void>;
  conteoPorDia(r: RangoFechas): Promise<ConteoDia[]>;
  topProductosVistos(r: RangoFechas, limite: number): Promise<Array<{ productoId: number; nombre: string; vistas: number }>>;
  topTerminos(r: RangoFechas, limite: number): Promise<Array<{ termino: string; busquedas: number }>>;
  /** Vistas (del producto de la oferta) y clicks (de la oferta) SOLO de las ofertas del proveedor. */
  conteoPorOfertaDia(r: RangoFechas, proveedorId: number): Promise<ConteoOfertaDia[]>;
}
