import { describe, expect, it } from "vitest";
import { base32Codificar, base32Decodificar, codigoHotp, generarSecretoTotp, otpauthUrl, verificarCodigoTotp } from "./totp.js";
import { cifrarSecreto, descifrarSecreto } from "./mfa.js";

// Semilla de los vectores de prueba de la RFC 6238 (apendice B, SHA1).
const SEMILLA = Buffer.from("12345678901234567890");
const SEMILLA_B32 = base32Codificar(SEMILLA);

describe("TOTP (RFC 6238)", () => {
  it("vectores oficiales de la RFC (6 ultimos digitos)", () => {
    const casos: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"]
    ];
    for (const [t, esperado] of casos) expect(codigoHotp(SEMILLA, Math.floor(t / 30))).toBe(esperado);
  });

  it("base32 ida y vuelta", () => {
    expect(SEMILLA_B32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decodificar(SEMILLA_B32).equals(SEMILLA)).toBe(true);
    expect(base32Decodificar(generarSecretoTotp())).toHaveLength(20);
  });

  it("acepta el paso actual y +-1, y devuelve en cual calzo", () => {
    const ahora = 1111111109 * 1000;
    const paso = Math.floor(1111111109 / 30);
    expect(verificarCodigoTotp(SEMILLA_B32, "081804", ahora)).toBe(paso);
    expect(verificarCodigoTotp(SEMILLA_B32, codigoHotp(SEMILLA, paso - 1), ahora)).toBe(paso - 1);
    expect(verificarCodigoTotp(SEMILLA_B32, codigoHotp(SEMILLA, paso + 1), ahora)).toBe(paso + 1);
    expect(verificarCodigoTotp(SEMILLA_B32, codigoHotp(SEMILLA, paso + 2), ahora)).toBeNull();
    expect(verificarCodigoTotp(SEMILLA_B32, "12345", ahora)).toBeNull();
  });

  it("otpauth URL con emisor y cuenta", () => {
    expect(otpauthUrl("Cotizapp", "admin@cotizapp.test", "ABC")).toBe(
      "otpauth://totp/Cotizapp%3Aadmin%40cotizapp.test?secret=ABC&issuer=Cotizapp&algorithm=SHA1&digits=6&period=30"
    );
  });
});

describe("cifrado del secreto", () => {
  it("cifra con IV aleatorio y descifra; un texto alterado no se descifra", () => {
    process.env.JWT_SECRET = "secreto-solo-para-test";
    const a = cifrarSecreto(SEMILLA_B32);
    const b = cifrarSecreto(SEMILLA_B32);
    expect(a).not.toBe(b);
    expect(a).not.toContain(SEMILLA_B32);
    expect(descifrarSecreto(a)).toBe(SEMILLA_B32);
    const alterado = a.slice(0, -4) + (a.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(descifrarSecreto(alterado)).toBeNull();
    expect(descifrarSecreto("texto-plano")).toBeNull();
  });
});
