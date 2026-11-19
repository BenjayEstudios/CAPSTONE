export type CarroEstado = "abierto" | "convertido" | "abandonado";

export interface CarroItem {
  ofertaId: number;
  cantidad: number;
  precioVisto: number;
}

// Ver DataBase/dbDiagram.sql -> Table carro. items es JSON (unicidad por oferta validada en aplicacion).
export interface Carro {
  id: number;
  usuarioId: number;
  estado: CarroEstado;
  items: CarroItem[];
  actualizadoEn: Date;
}
