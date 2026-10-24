import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { Categoria } from "./categorias.models";
import { CategoriasService, mensajeDeError } from "./categorias.service";
import { calcularCambiosOrden, slugify } from "./categorias.util";

const cat = (id: string, orden: number | null, nombre = id): Categoria => ({
  id, padreId: null, nombre, slug: id, orden, estado: "activa"
});

describe("CategoriasService", () => {
  let svc: CategoriasService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(CategoriasService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista el arbol incluyendo ocultas", () => {
    svc.listarArbol().subscribe();
    const r = http.expectOne(`${base}/categorias?incluirOcultas=true&arbol=true`);
    expect(r.request.method).toBe("GET");
    r.flush([]);
  });

  it("crea con POST", () => {
    svc.crear({ nombre: "A", slug: "a", padreId: "p" }).subscribe();
    const r = http.expectOne(`${base}/categorias`);
    expect(r.request.method).toBe("POST");
    expect(r.request.body).toEqual({ nombre: "A", slug: "a", padreId: "p" });
    r.flush(cat("a", 0));
  });

  it("actualiza con PATCH", () => {
    svc.actualizar("x", { estado: "oculta", orden: null }).subscribe();
    const r = http.expectOne(`${base}/categorias/x`);
    expect(r.request.method).toBe("PATCH");
    expect(r.request.body).toEqual({ estado: "oculta", orden: null });
    r.flush(cat("x", null));
  });

  it("traduce errores del servidor", () => {
    expect(mensajeDeError({ error: { error: { code: "SLUG_DUPLICADO", message: "dup" } } })).toContain("slug");
    expect(mensajeDeError({ error: { error: { code: "ARBOL_MAXIMO_2_NIVELES", message: "x" } } })).toContain("dos niveles");
    expect(mensajeDeError({ error: { error: { code: "OTRO", message: "boom" } } })).toBe("boom");
    expect(mensajeDeError(new Error("x"))).toContain("No se pudo");
  });
});

describe("slugify", () => {
  it("normaliza acentos, espacios y simbolos", () => {
    expect(slugify("  Ropa de Niños & Más! ")).toBe("ropa-de-ninos-mas");
    expect(slugify("Hogar 2024")).toBe("hogar-2024");
  });
});

describe("calcularCambiosOrden", () => {
  const lista = [cat("a", 0), cat("b", 1), cat("c", 2)];
  it("sube intercambiando con el anterior", () => {
    expect(calcularCambiosOrden(lista, "b", "subir")).toEqual([{ id: "b", orden: 0 }, { id: "a", orden: 1 }]);
  });
  it("baja intercambiando con el siguiente", () => {
    expect(calcularCambiosOrden(lista, "b", "bajar")).toEqual([{ id: "c", orden: 1 }, { id: "b", orden: 2 }]);
  });
  it("no hace nada en los extremos", () => {
    expect(calcularCambiosOrden(lista, "a", "subir")).toEqual([]);
    expect(calcularCambiosOrden(lista, "c", "bajar")).toEqual([]);
  });
  it("reindexa cuando los ordenes son nulos o iguales", () => {
    const l = [cat("a", null, "A"), cat("b", null, "B")];
    expect(calcularCambiosOrden(l, "b", "subir")).toEqual([{ id: "b", orden: 0 }, { id: "a", orden: 1 }]);
  });
});
