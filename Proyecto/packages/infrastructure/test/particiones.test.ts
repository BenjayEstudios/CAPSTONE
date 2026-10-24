import { describe, expect, it } from "vitest";
import { particionesFaltantes, sqlReorganizar } from "../src/db/particiones/particiones.js";

// Logica pura: corre tambien en CI (no necesita MySQL).
const fecha = (s: string) => new Date(`${s}T00:00:00Z`);

describe("particionesFaltantes", () => {
  it("agrega los meses que faltan desde el ultimo limite hasta el mes objetivo", () => {
    const limites = [fecha("2026-09-01"), fecha("2026-10-01"), fecha("2027-01-01")];
    expect(particionesFaltantes(limites, fecha("2027-03-15"))).toEqual([
      { nombre: "p202701", menorQue: "2027-02-01" },
      { nombre: "p202702", menorQue: "2027-03-01" },
      { nombre: "p202703", menorQue: "2027-04-01" }
    ]);
  });

  it("no agrega nada si el mes objetivo ya esta cubierto (idempotente)", () => {
    expect(particionesFaltantes([fecha("2027-01-01")], fecha("2026-12-31"))).toEqual([]);
  });

  it("falla si la tabla no esta particionada", () => {
    expect(() => particionesFaltantes([], fecha("2026-12-01"))).toThrow(/migracion 0004/);
  });
});

describe("sqlReorganizar", () => {
  it("parte pmax y la deja al final", () => {
    expect(sqlReorganizar([{ nombre: "p202701", menorQue: "2027-02-01" }])).toBe(
      "ALTER TABLE `evento_analitico` REORGANIZE PARTITION `pmax` INTO (" +
        "PARTITION `p202701` VALUES LESS THAN ('2027-02-01'), PARTITION `pmax` VALUES LESS THAN (MAXVALUE))"
    );
  });
});
