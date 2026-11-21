import { UsuarioSesion } from "../models/auth.models";

// Usuario para los specs (no se usa fuera de los tests).
export function usuarioDePrueba(over: Partial<UsuarioSesion> = {}): UsuarioSesion {
  return {
    id: 10,
    nombre: "Marta Rojas",
    email: "compras@lamarraqueta.test",
    organizacionId: 8,
    rol: "comprador",
    permisos: { ver_ordenes_propias: "total" },
    organizacion: { id: 8, nombre: "La Marraqueta", tipo: "cliente" },
    ...over
  };
}
