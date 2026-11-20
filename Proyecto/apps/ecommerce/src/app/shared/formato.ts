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

/** Precio por kg, L o unidad: 12490 por un bidon de 5 L -> "$2.498/L"; sin contenido -> "—". */
export function precioPorUnidad(precio: number, contenido: number | null, unidad: "kg" | "L" | "unidad"): string {
  if (!contenido || contenido <= 0) return "—";
  return `${formatearClp(Math.round(precio / contenido))}/${unidad === "unidad" ? "u" : unidad}`;
}

/** Plazo de entrega: 24 -> "24 h"; 120 -> "5 días"; null -> "a convenir". */
export function plazo(horas: number | null): string {
  if (horas === null) return "a convenir";
  if (horas <= 48) return `${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "1 día" : `${dias} días`;
}

/** Fecha de la franja superior: "viernes 20 de noviembre de 2026". */
export function fechaLarga(fecha = new Date()): string {
  return fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
