import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { environment } from "../environments/environment";
import { AppComponent } from "./app.component";
import { CarroState } from "./core/state/carro.state";
import { SessionState } from "./core/state/session.state";
import { usuarioDePrueba } from "./core/testing/usuario-de-prueba";

const url = (p: string) => `${environment.apiUrl}${p}`;

describe("AppComponent (cabecera)", () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.clear());

  function crear() {
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    ctrl.expectOne(url("/catalogo/resumen")).flush({
      proveedoresActivos: 3,
      productosComparados: 17,
      categorias: [{ id: 1, nombre: "Abarrotes", slug: "abarrotes", productos: 4, hijos: [{ id: 8, nombre: "Aceites", slug: "aceites", productos: 2, hijos: [] }] }]
    });
    return f;
  }

  it("sin sesion: ingresar, crear cuenta y el carro en cero", async () => {
    const f = crear();
    await f.whenStable();
    f.detectChanges();
    const texto = f.nativeElement.querySelector(".acciones").textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Ingresar");
    expect(texto).toContain("Crear cuenta");
    expect(texto).toContain("Ver carro · 0 · $0");
    expect(texto).toContain("Sin proveedores aún");
  });

  it("franja con proveedores activos y barra de categorias de nivel 1 y 2", async () => {
    const f = crear();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector(".franja").textContent).toContain("3 proveedores activos");
    const cats = [...f.nativeElement.querySelectorAll(".categorias a")].map((a: HTMLElement) => a.textContent?.trim());
    expect(cats).toEqual(["Todos", "Abarrotes", "Aceites"]);
  });

  it("el buscador lleva a /catalogo?q=", () => {
    const f = crear();
    const nav = spyOn(TestBed.inject(Router), "navigate").and.resolveTo(true);
    f.componentInstance.busqueda = "  aceite ";
    f.componentInstance.buscar();
    expect(nav).toHaveBeenCalledWith(["/buscar"], { queryParams: { q: "aceite" } });
  });

  it("con sesion de comprador: saludo, y el carro con cantidad y total", async () => {
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    const f = crear();
    TestBed.inject(CarroState).items.set([
      { ofertaId: 1, cantidad: 2, precioActual: 1000, precioVisto: 1000, productoId: 1, nombreProducto: "A", formato: null, proveedorId: 2, disponible: true, cajasDisponibles: 9 }
    ]);
    ctrl.match(url("/carro")).forEach((r) => r.flush({ id: 1, estado: "abierto", items: [] }));
    TestBed.inject(CarroState).items.set([
      { ofertaId: 1, cantidad: 2, precioActual: 1000, precioVisto: 1000, productoId: 1, nombreProducto: "A", formato: null, proveedorId: 2, disponible: true, cajasDisponibles: 9 }
    ]);
    f.detectChanges();
    const texto = f.nativeElement.querySelector(".acciones").textContent.replace(/\s+/g, " ");
    expect(texto).toContain("Hola, Marta");
    expect(texto).toContain("Ver carro · 1 · $2.000");
    expect(texto).toContain("1 proveedor");
  });
});
