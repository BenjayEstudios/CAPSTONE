import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { crearControlMfa, type DepsMfa } from "@cotizapp/application";
import type { DesafioMfaClaims } from "@cotizapp/domain";
import { generarSecretoTotp, otpauthUrl, verificarCodigoTotp } from "./totp.js";

// Estado en memoria compartido por todas las rutas (una sola instancia del
// backend; ver README: limitaciones del 2FA sin estado servidor).
const control = crearControlMfa();

const EMISOR = "Cotizapp";
const PREFIJO = "v1:";

// Clave AES-256 para cifrar mfa_secreto. MFA_CLAVE_CIFRADO (32 bytes en
// base64) si existe; si no, se deriva de JWT_SECRET con un contexto propio.
// Ojo: con la derivada, rotar JWT_SECRET deja ilegibles los secretos y obliga
// a re-enrolar (poner mfa_estado = pendiente).
function claveCifrado(): Buffer {
  const propia = process.env.MFA_CLAVE_CIFRADO;
  if (propia) {
    const k = Buffer.from(propia, "base64");
    if (k.length !== 32) throw new Error("MFA_CLAVE_CIFRADO debe ser de 32 bytes en base64");
    return k;
  }
  return createHash("sha256").update(`cotizapp-mfa-secreto:${process.env.JWT_SECRET as string}`).digest();
}

// AES-256-GCM: "v1:" + base64(iv(12) | tag(16) | texto cifrado).
export function cifrarSecreto(secreto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", claveCifrado(), iv);
  const datos = Buffer.concat([c.update(secreto, "utf8"), c.final()]);
  return PREFIJO + Buffer.concat([iv, c.getAuthTag(), datos]).toString("base64");
}

export function descifrarSecreto(cifrado: string): string | null {
  try {
    if (!cifrado.startsWith(PREFIJO)) return null;
    const crudo = Buffer.from(cifrado.slice(PREFIJO.length), "base64");
    const d = createDecipheriv("aes-256-gcm", claveCifrado(), crudo.subarray(0, 12));
    d.setAuthTag(crudo.subarray(12, 28));
    return Buffer.concat([d.update(crudo.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function crearDepsMfa(): DepsMfa {
  const secreto = process.env.JWT_SECRET as string;
  return {
    control,
    generarSecreto: generarSecretoTotp,
    verificarCodigo: (s, codigo) => verificarCodigoTotp(s, codigo),
    cifrar: cifrarSecreto,
    descifrar: descifrarSecreto,
    otpauthUrl: (email, s) => otpauthUrl(EMISOR, email, s),
    qrDataUrl: (texto) => QRCode.toDataURL(texto, { errorCorrectionLevel: "M", margin: 1, width: 220 }),
    nuevoId: () => randomUUID(),
    firmarDesafio: (claims, minutos) => jwt.sign(claims, secreto, { expiresIn: `${minutos}m` }),
    verificarDesafio: (token) => {
      try {
        const c = jwt.verify(token, secreto) as Partial<DesafioMfaClaims>;
        const tipos: Array<DesafioMfaClaims["tipo"]> = ["mfa", "mfa_enrolamiento", "mfa_confirmacion"];
        if (!c.sub || !c.jti || !c.tipo || !tipos.includes(c.tipo)) return null;
        return { sub: c.sub, tipo: c.tipo, jti: c.jti };
      } catch {
        return null;
      }
    }
  };
}
