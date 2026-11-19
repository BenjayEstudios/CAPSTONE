import { ErrorAplicacion } from "./errors.js";

// Forma minima de un schema Zod (application no depende de zod directamente).
interface SchemaLike<T> {
  safeParse(
    input: unknown
  ): { success: true; data: T } | { success: false; error: { issues: Array<{ path: Array<string | number>; message: string }> } };
}

// Valida con un schema de @cotizapp/domain y traduce el fallo a
// ErrorAplicacion 400 VALIDACION (mismo formato que el resto de errores).
export function validar<T>(schema: SchemaLike<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
    throw new ErrorAplicacion(400, "VALIDACION", detalle);
  }
  return r.data;
}
