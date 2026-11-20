const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-CL");

/** 12490 -> "$12.490" */
export function formatearClp(monto: number): string {
  return clp.format(monto).replace(/\s/g, "");
}

/** 34000 -> "34.000" */
export function formatearEntero(n: number): string {
  return entero.format(n);
}

/** Fecha de la franja superior: "viernes 20 de noviembre de 2026". */
export function fechaLarga(fecha = new Date()): string {
  return fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
