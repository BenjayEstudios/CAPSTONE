import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { CatalogoService, construirParams, etiquetasCategorias, formatearPrecio } from "./catalogo.service";

describe("CatalogoService", () => {
  let svc: CatalogoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(CatalogoService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("arma query params con filtros", () => {
    svc.listar({ estado: "publicado", categoriaId: "c1", q: " leche ", pagina: 2, tamano: 20 }).subscribe();
    const req = http.expectOne((r) => r.urlWithParams.startsWith(`${environment.apiUrl}/productos`));
    const url = new URL(req.request.urlWithParams, "http://x");
    expect(url.searchParams.get("estado")).toBe("publicado");
    expect(url.searchParams.get("categoriaId")).toBe("c1");
    expect(url.searchParams.get("q")).toBe("leche");
    expect(url.searchParams.get("pagina")).toBe("2");
    expect(url.searchParams.get("tamano")).toBe("20");
    req.flush({ items: [], pagina: 2, tamano: 20, total: 0, totalPaginas: 0 });
  });

  it("omite filtros vacios y usa defaults de paginacion", () => {
    const p = construirParams({ estado: "", categoriaId: "", q: "  " });
    expect(p.has("estado")).toBeFalse();
    expect(p.has("categoriaId")).toBeFalse();
    expect(p.has("q")).toBeFalse();
    expect(p.get("pagina")).toBe("1");
    expect(p.get("tamano")).toBe("20");
  });

  it("pide categorias incluyendo ocultas", () => {
    svc.categorias().subscribe();
    http.expectOne(`${environment.apiUrl}/categorias?incluirOcultas=true`).flush([]);
  });

  it("etiqueta categorias como Padre > Hija", () => {
    const base = { slug: "", orden: 0, estado: "visible" };
    const r = etiquetasCategorias([
      { ...base, id: "2", padreId: "1", nombre: "Lácteos" },
      { ...base, id: "1", padreId: null, nombre: "Alimentos" }
    ]);
    expect(r.map((x) => x.etiqueta)).toEqual(["Alimentos", "Alimentos > Lácteos"]);
  });

  it("crea, actualiza, sube archivo y reemplaza imagenes", () => {
    svc.crear({ nombre: "A", sku: "A1", categoriaId: 1, unidad: "kg" }).subscribe();
    const post = http.expectOne(`${environment.apiUrl}/productos`);
    expect(post.request.method).toBe("POST");
    post.flush({});

    svc.actualizar("5", { estado: "publicado" }).subscribe();
    const patch = http.expectOne(`${environment.apiUrl}/productos/5`);
    expect(patch.request.method).toBe("PATCH");
    expect(patch.request.body).toEqual({ estado: "publicado" });
    patch.flush({});

    svc.subirImagen("5", new File(["x"], "a.png", { type: "image/png" })).subscribe();
    const up = http.expectOne(`${environment.apiUrl}/productos/5/imagenes/archivo`);
    expect(up.request.method).toBe("POST");
    expect(up.request.body instanceof FormData).toBeTrue();
    up.flush({ url: "u", clave: "c", ancho: 1200, alto: 800 });

    svc.guardarImagenes("5", [{ url: "u", esPrincipal: true, orden: 0 }]).subscribe();
    const put = http.expectOne(`${environment.apiUrl}/productos/5/imagenes`);
    expect(put.request.method).toBe("PUT");
    expect(put.request.body).toEqual({ imagenes: [{ url: "u", esPrincipal: true, orden: 0 }] });
    put.flush({});
  });
});

describe("formatearPrecio", () => {
  it("devuelve guion largo sin precio", () => {
    expect(formatearPrecio(null)).toBe("—");
    expect(formatearPrecio(undefined)).toBe("—");
  });
  it("formatea CLP sin decimales con separador de miles", () => {
    const s = formatearPrecio(1234567);
    expect(s).toContain("1.234.567");
    expect(s).toContain("$");
    expect(s).not.toContain(",");
  });
});
