import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CorreoConsola } from "./correo-consola.js";
import { CorreoEnMemoria } from "./correo-memoria.js";
import { generarClaveTemporal } from "../seguridad/clave-temporal.js";

describe("CorreoConsola", () => {
  it("no registra el cuerpo en el log; lo escribe solo si hay directorio", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mail-"));
    const logs: string[] = [];
    try {
      await new CorreoConsola({ log: (m) => logs.push(m) }).enviar({ para: "a@b.cl", asunto: "Hola", texto: "SECRETO-123" });
      expect(logs.join("\n")).not.toContain("SECRETO-123");
      expect(readdirSync(dir)).toHaveLength(0);
      await new CorreoConsola({ directorioSalida: dir, log: (m) => logs.push(m) }).enviar({ para: "a@b.cl", asunto: "Hola", texto: "SECRETO-123" });
      expect(logs.join("\n")).not.toContain("SECRETO-123");
      const [f] = readdirSync(dir);
      expect(readFileSync(path.join(dir, f as string), "utf8")).toContain("SECRETO-123");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("CorreoEnMemoria", () => {
  it("acumula y puede fallar", async () => {
    const c = new CorreoEnMemoria();
    await c.enviar({ para: "a@b.cl", asunto: "x", texto: "y" });
    expect(c.enviados).toHaveLength(1);
    c.falla = true;
    await expect(c.enviar({ para: "a@b.cl", asunto: "x", texto: "y" })).rejects.toThrow();
  });
});

describe("generarClaveTemporal", () => {
  it("12+ caracteres, compleja y distinta cada vez", () => {
    const a = generarClaveTemporal();
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(a).toMatch(/[A-Z]/);
    expect(a).toMatch(/[a-z]/);
    expect(a).toMatch(/\d/);
    expect(a).toMatch(/[^A-Za-z0-9]/);
    expect(generarClaveTemporal()).not.toBe(a);
    expect(generarClaveTemporal(4).length).toBe(12);
  });
});
