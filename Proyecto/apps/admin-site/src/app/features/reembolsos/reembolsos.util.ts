export type ModoReembolso = "total" | "parcial";

export interface ValidacionReembolso {
  monto?: number;
  error?: string;
  errorMotivo?: string;
}

/** Valida el formulario: total usa el saldo; parcial exige un entero CLP entre 1 y el saldo. */
export function validarReembolso(modo: ModoReembolso, montoTexto: string, motivo: string, saldo: number): ValidacionReembolso {
  const m = motivo.trim();
  const errorMotivo = m.length === 0 ? "Indica el motivo del reembolso." : m.length > 300 ? "El motivo admite hasta 300 caracteres." : undefined;
  if (modo === "total") return { monto: saldo, errorMotivo };
  const limpio = montoTexto.replace(/[.\s$]/g, "");
  if (!/^\d+$/.test(limpio)) return { error: "Ingresa un monto en pesos (número entero).", errorMotivo };
  const monto = Number(limpio);
  if (monto < 1) return { error: "El monto debe ser mayor a 0.", errorMotivo };
  if (monto > saldo) return { error: "El monto excede el saldo reembolsable.", errorMotivo };
  return { monto, errorMotivo };
}

export function mensajeErrorReembolsos(e: any): string {
  const status = e?.status;
  const code = e?.error?.error?.code as string | undefined;
  const msg = e?.error?.error?.message as string | undefined;
  if (status === 403) return "No tienes permiso para emitir reembolsos.";
  if (status === 0) return "No hay conexión con el servidor.";
  if (code === "MONTO_EXCEDE_SALDO") return msg ?? "El monto excede el saldo reembolsable.";
  if (code === "ORDEN_NO_PAGADA") return "La orden no está pagada: no se puede reembolsar.";
  if (status === 404) return msg ?? "La orden no existe.";
  return msg ?? "Ocurrió un error inesperado. Inténtalo nuevamente.";
}
