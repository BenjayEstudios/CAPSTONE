import type { Calificacion, ResumenCalificacionProveedor } from "../entities/calificacion.entity.js";
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
}
