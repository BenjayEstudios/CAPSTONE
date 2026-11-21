// Planificador de busqueda de texto para listados administrativos.
//
// `LIKE '%texto%'` no puede usar indices: recorre la tabla completa (medido: 1,3 s con
// 500 mil usuarios, lineal con el tamano). Se reemplaza por:
//  - FULLTEXT en modo booleano con prefijo de palabra (`+garc* +juan*`): encuentra por
//    nombre, apellido, parte local del correo o dominio, usando el indice.
//  - Prefijo (`texto%`) cuando el texto es demasiado corto para el indice FULLTEXT
//    (InnoDB no indexa palabras de menos de 3 caracteres).
// El texto del usuario NUNCA llega crudo a la expresion booleana: solo pasan letras,
// digitos y guion bajo, asi que no se pueden inyectar operadores (+ - < > ( ) ~ * ").

export type BusquedaTexto =
  | { modo: "fulltext"; expresion: string }
  | { modo: "prefijo"; patron: string };

const LARGO_MIN_PALABRA = 3; // innodb_ft_min_token_size por defecto
const LARGO_MAX_PALABRA = 40;
const MAX_PALABRAS = 6;

// Lista de stopwords de InnoDB de 3+ letras: una palabra asi dentro de un `+termino*`
// hace que la busqueda no devuelva nada, asi que se descarta antes de armar la expresion.
const STOPWORDS = new Set(["about", "are", "com", "for", "from", "how", "that", "the", "this", "was", "what", "when", "where", "who", "will", "with", "und", "www"]);

/** Escapa `\`, `%` y `_` para usar el texto como literal dentro de un LIKE. */
export function escaparLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function planBusqueda(q: string): BusquedaTexto {
  const texto = q.trim();
  const palabras = (texto.match(/[\p{L}\p{N}_]+/gu) ?? [])
    .map((p) => p.toLowerCase().slice(0, LARGO_MAX_PALABRA))
    .filter((p) => p.length >= LARGO_MIN_PALABRA && !STOPWORDS.has(p))
    .slice(0, MAX_PALABRAS);

  if (palabras.length > 0) return { modo: "fulltext", expresion: palabras.map((p) => `+${p}*`).join(" ") };
  return { modo: "prefijo", patron: `${escaparLike(texto)}%` };
}

/** Un RUT chileno parcial o completo (con o sin puntos y guion): se busca por prefijo del indice unico. */
export function pareceRut(q: string): boolean {
  return /^[0-9.\-kK]{3,}$/.test(q.trim()) && /\d/.test(q);
}
