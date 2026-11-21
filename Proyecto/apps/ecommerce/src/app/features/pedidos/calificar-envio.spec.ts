import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { EnvioOrden, OrdenDetalle } from "../../core/models/checkout.models";
import { CalificarEnvioComponent } from "./calificar-envio.component";
import { DetalleOrdenComponent } from "./detalle-orden.component";

const API = environment.apiUrl;
const envio = (estado: string, calificacion: EnvioOrden["calificacion"] = null): EnvioOrden => ({
  id: 21, proveedorId: 3, proveedorNombre: "Comercial Valle Central SpA", modalidad: "despacho", plazoHoras: 48, costoDespacho: 5990,
  subtotal: 28920, estado, lineas: [], puntoRetiro: null, calificacion
});

describe("Calificar al distribuidor (KAN-99)", () => {
  let ctrl: HttpTestingController;

  function montar(e: EnvioOrden) {
    TestBed.configureTestingModule({ imports: [CalificarEnvioComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(CalificarEnvioComponent);
    f.componentRef.setInput("envio", e);
    f.detectChanges();
    return f;
  }
  const texto = (el: HTMLElement) => el.textContent!.replace(/\s+/g, " ");

  it("pide puntaje 1 a 5 (el boton espera el puntaje) y envia puntaje y comentario", async () => {
    const f = montar(envio("entregado"));
    const el = f.nativeElement as HTMLElement;
    expect(texto(el)).toContain("¿Cómo te fue con Comercial Valle Central SpA?");
    const boton = el.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
    expect(el.querySelectorAll("input[type=radio]")).toHaveSize(5);

    (el.querySelectorAll("input[type=radio]")[3] as HTMLInputElement).click();
    f.componentInstance.comentario = "  Llegó a tiempo  ";
    f.detectChanges();
    expect(boton.disabled).toBeFalse();
    expect(texto(el)).toContain("Bueno");

    const p = f.componentInstance.enviar();
    const req = ctrl.expectOne(`${API}/ordenes/envios/21/calificacion`);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ puntaje: 4, comentario: "Llegó a tiempo" });
    req.flush({ id: 30, ordenEnvioId: 21, usuarioId: 8, puntaje: 4, comentario: "Llegó a tiempo", creadaEn: "2026-11-20T12:00:00Z" });
    await p;
    f.detectChanges();
    expect(texto(el)).toContain("Tu calificación");
    expect(texto(el)).toContain("“Llegó a tiempo”");
    expect(texto(el)).toContain("Se suma al promedio de Comercial Valle Central SpA");
    expect(el.querySelector("form")).toBeNull();
  });

  it("si ya califico muestra su calificacion; YA_CALIFICADO se explica", async () => {
    const hecha = montar(envio("entregado", { puntaje: 5, comentario: null, creadaEn: "" }));
    expect(texto(hecha.nativeElement)).toContain("Tu calificación");
    expect(hecha.nativeElement.querySelectorAll(".estrellas .llena")).toHaveSize(5);
    expect(hecha.nativeElement.querySelector("form")).toBeNull();

    TestBed.resetTestingModule();
    const f = montar(envio("entregado"));
    f.componentInstance.puntaje.set(3);
    const p = f.componentInstance.enviar();
    ctrl.expectOne(`${API}/ordenes/envios/21/calificacion`).flush({ error: { code: "YA_CALIFICADO" } }, { status: 409, statusText: "x" });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement)).toContain("Este envío ya fue calificado.");
  });

  it("el detalle solo ofrece calificar los envios entregados", () => {
    TestBed.configureTestingModule({ imports: [DetalleOrdenComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(DetalleOrdenComponent);
    const orden: OrdenDetalle = {
      id: 11, codigo: "CM-10011", estado: "pagada", estadoPago: "pagado", medioPago: "tarjeta", creadaEn: "", pagadoEn: "2026-10-21T21:07:00Z",
      requiereFactura: false, subtotal: 0, costoDespachoTotal: 0, total: 0, envios: [envio("entregado"), { ...envio("despachado"), id: 22 }]
    };
    f.componentRef.setInput("orden", orden);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll("app-calificar-envio")).toHaveSize(1);
  });
});
