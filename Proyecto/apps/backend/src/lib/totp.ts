import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// TOTP segun RFC 6238 (HMAC-SHA1, 6 digitos, pasos de 30 s): lo que usan
// Google Authenticator, Microsoft Authenticator y Authy. Sin dependencias.

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIODO_SEG = 30;
export const TOTP_DIGITOS = 6;

export function base32Codificar(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decodificar(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valor = 0;
  const salida: number[] = [];
  for (const c of limpio) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error("Secreto base32 invalido");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(salida);
}

/** 160 bits aleatorios (lo que recomienda la RFC 4226 para HMAC-SHA1). */
export function generarSecretoTotp(): string {
  return base32Codificar(randomBytes(20));
}

/** Codigo HOTP (RFC 4226) para un contador. */
export function codigoHotp(secreto: Buffer, contador: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const mac = createHmac("sha1", secreto).update(msg).digest();
  const desplazamiento = mac[mac.length - 1]! & 0x0f;
  const binario = mac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(binario % 10 ** TOTP_DIGITOS).padStart(TOTP_DIGITOS, "0");
}

export function pasoTotp(ahoraMs: number): number {
  return Math.floor(ahoraMs / 1000 / TOTP_PERIODO_SEG);
}

/**
 * Devuelve el paso en que calza el codigo (el actual o +-`ventana` pasos,
 * para tolerar relojes algo desfasados) o null. Compara en tiempo constante.
 */
export function verificarCodigoTotp(secretoBase32: string, codigo: string, ahoraMs = Date.now(), ventana = 1): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const secreto = base32Decodificar(secretoBase32);
  const paso = pasoTotp(ahoraMs);
  let encontrado: number | null = null;
  for (let d = -ventana; d <= ventana; d++) {
    const esperado = Buffer.from(codigoHotp(secreto, paso + d));
    // Se recorren todas las ventanas aunque una calce, para no filtrar cual por tiempos.
    if (timingSafeEqual(esperado, Buffer.from(codigo)) && encontrado === null) encontrado = paso + d;
  }
  return encontrado;
}

/** URI que entienden las apps autenticadoras (se codifica en el QR). */
export function otpauthUrl(emisor: string, cuenta: string, secretoBase32: string): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const params = new URLSearchParams({
    secret: secretoBase32,
    issuer: emisor,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITOS),
    period: String(TOTP_PERIODO_SEG)
  });
  return `otpauth://totp/${etiqueta}?${params.toString()}`;
}
