import { describe, expect, it } from "vitest";
import { HistorialInvalido, planificar, type MigracionLocal } from "../src/db/migrar/historial.js";

// Logica pura: corre tambien en CI (no necesita MySQL).
const m0: MigracionLocal = { tag: "0000_inicial", hash: "a".repeat(64), creadaEn: 1000 };
const m1: MigracionLocal = { tag: "0001_indices", hash: "b".repeat(64), creadaEn: 2000 };

describe("planificar", () => {
  it("base vacia: todo pendiente", () => {
    expect(planificar([m0, m1], [])).toEqual({ aplicadas: [], pendientes: [m0, m1] });
  });

  it("aplica solo lo que falta", () => {
    expect(planificar([m0, m1], [{ hash: m0.hash, created_at: 1000 }])).toEqual({ aplicadas: [m0], pendientes: [m1] });
  });

  it("todo aplicado: no hace nada (idempotente)", () => {
    const historial = [
      { hash: m0.hash, created_at: "1000" },
      { hash: m1.hash, created_at: "2000" }
    ];
    expect(planificar([m0, m1], historial).pendientes).toEqual([]);
  });

  it("falla si el historial tiene una migracion que no existe en migrations/", () => {
    const historial = [{ hash: "c".repeat(64), created_at: 500 }];
    expect(() => planificar([m0, m1], historial)).toThrow(HistorialInvalido);
    expect(() => planificar([m0, m1], historial)).toThrow(/1 fila\(s\) que no corresponden/);
  });

  it("falla con una migracion vieja aunque su fecha sea posterior (drizzle se saltaria todo)", () => {
    expect(() => planificar([m0, m1], [{ hash: "d".repeat(64), created_at: 9999 }])).toThrow(HistorialInvalido);
  });

  it("falla si una migracion local quedo atras de la ultima aplicada", () => {
    expect(() => planificar([m0, m1], [{ hash: m1.hash, created_at: 2000 }])).toThrow(/0000_inicial no esta aplicada/);
  });
});
