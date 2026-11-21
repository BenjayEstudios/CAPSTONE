import { createHmac, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { RECUPERACION_VALIDEZ_MIN, type DepsRecuperacion } from "@cotizapp/application";
import type { RecuperacionClaims } from "@cotizapp/domain";

// Enlace de recuperacion de clave: JWT corto firmado con JWT_SECRET. Sin
// tabla de tokens: el claim "huella" es un HMAC de hash_clave, asi el enlace
// deja de servir apenas la clave cambia (un solo uso) sin estado servidor.
export function crearDepsRecuperacion(urls: { ecommerce: string; adminSite: string }): DepsRecuperacion {
  const secreto = process.env.JWT_SECRET as string;
  return {
    firmar: (claims) => jwt.sign(claims, secreto, { expiresIn: `${RECUPERACION_VALIDEZ_MIN}m` }),
    verificar: (token) => {
      try {
        const c = jwt.verify(token, secreto) as Partial<RecuperacionClaims>;
        if (c.tipo !== "recuperacion" || !c.sub || !c.huella) return null;
        return { sub: c.sub, tipo: "recuperacion", huella: c.huella };
      } catch {
        return null;
      }
    },
    huella: (hashClave) => createHmac("sha256", secreto).update(`recuperacion:${hashClave}`).digest("hex").slice(0, 32),
    igualesSeguro: (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
    urlSitio: (tipo) => (tipo === "interna" ? urls.adminSite : urls.ecommerce).replace(/\/+$/, "")
  };
}
