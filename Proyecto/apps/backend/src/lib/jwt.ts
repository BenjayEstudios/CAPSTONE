import jwt from "jsonwebtoken";
import type { TokenClaims } from "@cotizapp/domain";

// Firma del token: vive en apps/backend (application no conoce JWT). Los
// claims deben coincidir con AuthClaims de plugins/auth.ts.
export function firmarToken(claims: TokenClaims): string {
  return jwt.sign(claims, process.env.JWT_SECRET as string, { expiresIn: "8h" });
}
