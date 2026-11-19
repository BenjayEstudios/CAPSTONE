import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { crearControlMfa, MFA_VALIDEZ_MIN, type DepsMfa } from "@cotizapp/application";
import type { DesafioMfaClaims, ServicioCorreo } from "@cotizapp/domain";

// Estado en memoria compartido por todas las rutas (una sola instancia del
// backend; ver README: limitaciones del 2FA sin estado servidor).
const control = crearControlMfa();

export function crearDepsMfa(servicioCorreo: ServicioCorreo): DepsMfa {
  const secreto = process.env.JWT_SECRET as string;
  return {
    servicioCorreo,
    control,
    generarCodigo: () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
    nuevoId: () => randomUUID(),
    hashCodigo: (sub, codigo) => createHmac("sha256", secreto).update(`${sub}:${codigo}`).digest("hex"),
    igualesSeguro: (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
    firmarDesafio: (claims) => jwt.sign(claims, secreto, { expiresIn: `${MFA_VALIDEZ_MIN}m` }),
    verificarDesafio: (token) => {
      try {
        const c = jwt.verify(token, secreto) as Partial<DesafioMfaClaims>;
        if (c.tipo !== "mfa" || !c.sub || !c.hash || !c.jti) return null;
        return { sub: c.sub, tipo: "mfa", hash: c.hash, jti: c.jti };
      } catch {
        return null;
      }
    }
  };
}
