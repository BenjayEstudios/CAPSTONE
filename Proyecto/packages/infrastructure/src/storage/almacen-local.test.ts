import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AlmacenLocal } from "./almacen-local.js";

let dir: string;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function almacen() {
  dir = await mkdtemp(path.join(os.tmpdir(), "almacen-"));
  return new AlmacenLocal({ directorio: dir, urlBase: "http://localhost:8000/" });
}

describe("AlmacenLocal", () => {
  it("guarda y elimina, devolviendo url publica", async () => {
    const a = await almacen();
    const r = await a.guardar(new Uint8Array([1, 2, 3]), "productos/1/x.png", "image/png");
    expect(r).toEqual({ clave: "productos/1/x.png", url: "http://localhost:8000/uploads/productos/1/x.png" });
    expect([...(await readFile(path.join(dir, r.clave)))]).toEqual([1, 2, 3]);
    await a.eliminar(r.clave);
    await expect(stat(path.join(dir, r.clave))).rejects.toThrow();
  });
  it("rechaza path traversal", async () => {
    const a = await almacen();
    await expect(a.guardar(new Uint8Array([1]), "../fuera.png", "image/png")).rejects.toThrow();
    await expect(a.eliminar("../../etc/passwd")).rejects.toThrow();
  });
});
