import type {
  Calificacion,
  CalificacionRecibida,
  ResumenCalificacionProveedor,
  ResumenCalificacionesRecibidas
} from "../entities/calificacion.entity.js";
import type { RegistrarCalificacionDto } from "../dtos/calificacion.dto.js";

// Puerto de las calificaciones de proveedores (KAN-142). Implementacion:
// DrizzleCalificacionRepository en @cotizapp/infrastructure.
export interface CalificacionRepository {
  // Solo si el envio esta entregado y el usuario pertenece a la organizacion
  // que hizo la orden; si no, lanza CalificacionError.
  registrar(input: RegistrarCalificacionDto): Promise<Calificacion>;
  // Promedio y cantidad por proveedor, para el comparador. Con ids, devuelve
  // una fila por cada id pedido (cantidad 0 si no tiene calificaciones).
  resumenPorProveedor(proveedorIds?: number[]): Promise<ResumenCalificacionProveedor[]>;
  // Ultimas calificaciones recibidas por un proveedor (panel "Resenas").
  listarPorProveedor(proveedorId: number, limite?: number): Promise<Calificacion[]>;
  // KAN-200: promedio, total y distribucion por puntaje de un proveedor.
  resumenRecibidas(proveedorId: number): Promise<ResumenCalificacionesRecibidas>;
  // KAN-200: pagina de calificaciones recibidas (mas nueva primero) con el
  // folio de la orden y la organizacion compradora. `total` ignora la pagina.
  listarRecibidas(proveedorId: number, p: { pagina: number; tamano: number }): Promise<{ items: CalificacionRecibida[]; total: number }>;
}
