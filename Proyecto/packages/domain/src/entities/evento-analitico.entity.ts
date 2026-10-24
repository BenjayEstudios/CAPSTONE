export type EventoTipo = "vista_producto" | "click_oferta" | "busqueda";
export type EventoOrigen = "catalogo" | "busqueda" | "directo";

// Ver DataBase/dbDiagram.sql -> Table evento_analitico. Las columnas no
// aplicables al tipo de evento quedan null.
export interface EventoAnalitico {
  id: number;
  tipoEvento: EventoTipo;
  productoId: number | null;
  ofertaId: number | null;
  usuarioId: number | null;
  sesionId: string;
  comunaId: number | null;
  origen: EventoOrigen | null;
  convirtio: boolean | null;
  termino: string | null;
  resultados: number | null;
  detalle: unknown;
  creadoEn: Date;
}
