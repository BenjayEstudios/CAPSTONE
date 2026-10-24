import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/l/I) para que sea facil de transcribir.
const MAYUS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUS = "abcdefghijkmnpqrstuvwxyz";
const DIGITOS = "23456789";
const SIMBOLOS = "!#$%*+-=?@";
const TODOS = MAYUS + MINUS + DIGITOS + SIMBOLOS;

const elegir = (s: string) => s[randomInt(s.length)] as string;

// Clave temporal criptograficamente segura (CSPRNG), minimo 12 caracteres con
// al menos una mayuscula, minuscula, digito y simbolo.
export function generarClaveTemporal(largo = 14): string {
  const n = Math.max(12, largo);
  const chars = [elegir(MAYUS), elegir(MINUS), elegir(DIGITOS), elegir(SIMBOLOS)];
  while (chars.length < n) chars.push(elegir(TODOS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join("");
}
