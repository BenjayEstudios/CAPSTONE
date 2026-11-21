import { describe, expect, it } from "vitest";
import { escaparLike, pareceRut, planBusqueda } from "./busqueda-texto.js";

describe("planBusqueda", () => {
  it("una palabra de 3+ letras usa FULLTEXT por prefijo de palabra", () => {
    expect(planBusqueda("Garcia")).toEqual({ modo: "fulltext", expresion: "+garcia*" });
  });
  it("varias palabras se exigen todas (AND)", () => {
    expect(planBusqueda("  Juan   Garcia ")).toEqual({ modo: "fulltext", expresion: "+juan* +garcia*" });
  });
  it("un correo se separa en palabras y descarta las stopwords (com, www)", () => {
    expect(planBusqueda("ana.soto@gmail.com")).toEqual({ modo: "fulltext", expresion: "+ana* +soto* +gmail*" });
  });
  it("conserva tildes y letras unicode", () => {
    expect(planBusqueda("Muñoz Pérez")).toEqual({ modo: "fulltext", expresion: "+muñoz* +pérez*" });
  });
  it("texto demasiado corto para el indice cae a prefijo escapado", () => {
    expect(planBusqueda("an")).toEqual({ modo: "prefijo", patron: "an%" });
    expect(planBusqueda("de la")).toEqual({ modo: "prefijo", patron: "de la%" });
    expect(planBusqueda("%_")).toEqual({ modo: "prefijo", patron: "\\%\\_%" });
  });
  it("una stopword sola cae a prefijo en vez de devolver siempre cero resultados", () => {
    expect(planBusqueda("com")).toEqual({ modo: "prefijo", patron: "com%" });
  });
  it("neutraliza operadores booleanos: nunca llegan a la expresion", () => {
    expect(planBusqueda('+admin* -root "x" (a) ~b <c> >d')).toEqual({ modo: "fulltext", expresion: "+admin* +root*" });
    expect(planBusqueda('"; DROP TABLE usuario; --')).toEqual({ modo: "fulltext", expresion: "+drop* +table* +usuario*" });
  });
  it("limita palabras y largo", () => {
    const e = (planBusqueda("aaa bbb ccc ddd eee fff ggg hhh") as { expresion: string }).expresion;
    expect(e.split(" ")).toHaveLength(6);
    expect((planBusqueda("x".repeat(500)) as { expresion: string }).expresion).toBe(`+${"x".repeat(40)}*`);
  });
});

describe("escaparLike / pareceRut", () => {
  it("escapa comodines y la barra", () => {
    expect(escaparLike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
  });
  it("reconoce RUT parcial o completo, no nombres", () => {
    expect(pareceRut("76.123.456-7")).toBe(true);
    expect(pareceRut("12345678-K")).toBe(true);
    expect(pareceRut("76")).toBe(false);
    expect(pareceRut("Panaderia 24")).toBe(false);
    expect(pareceRut("kkk")).toBe(false);
  });
});
