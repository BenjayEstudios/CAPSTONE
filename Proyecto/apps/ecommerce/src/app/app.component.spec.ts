import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { AppComponent } from "./app.component";
import { SessionState } from "./core/state/session.state";
import { usuarioDePrueba } from "./core/testing/usuario-de-prueba";

describe("AppComponent (cabecera)", () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
  });
  afterEach(() => localStorage.clear());

  it("sin sesion ofrece ingresar y crear cuenta", () => {
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    const texto = f.nativeElement.querySelector(".cuenta").textContent;
    expect(texto).toContain("Ingresar");
    expect(texto).toContain("Crear cuenta");
  });

  it("con sesion saluda con el nombre y la organizacion, y Salir la cierra", () => {
    TestBed.inject(SessionState).iniciar("t", usuarioDePrueba());
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector(".saludo").textContent).toContain("Hola, Marta");
    expect(f.nativeElement.querySelector(".saludo").textContent).toContain("La Marraqueta");
    f.componentInstance.salir();
    expect(TestBed.inject(SessionState).autenticado()).toBeFalse();
  });
});
