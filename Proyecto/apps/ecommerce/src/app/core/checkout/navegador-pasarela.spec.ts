import { DOCUMENT } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { NavegadorPasarela } from "./checkout.service";

// KAN-148: Webpay pide un formulario POST con token_ws; PayPal, un GET a su URL de aprobacion.
describe("NavegadorPasarela", () => {
  function preparar() {
    const assign = jasmine.createSpy("assign");
    const enviados: Array<{ method: string; action: string; campos: Record<string, string> }> = [];
    const fakeDocument = {
      location: { assign },
      body: { appendChild: () => undefined },
      createElement: (tag: string) => {
        if (tag === "form") {
          const form: { method: string; action: string; campos: Record<string, string>; appendChild: (i: { name: string; value: string }) => void; submit: () => void } = {
            method: "",
            action: "",
            campos: {},
            appendChild: (i) => {
              form.campos[i.name] = i.value;
            },
            submit: () => {
              enviados.push({ method: form.method, action: form.action, campos: form.campos });
            }
          };
          return form;
        }
        return { type: "", name: "", value: "" };
      }
    };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: fakeDocument }] });
    return { nav: TestBed.inject(NavegadorPasarela), assign, enviados };
  }

  it("POST (Webpay): envia token_ws en un formulario", () => {
    const { nav, assign, enviados } = preparar();
    nav.ir("https://webpay/init", "tok");
    expect(enviados).toEqual([{ method: "POST", action: "https://webpay/init", campos: { token_ws: "tok" } }]);
    expect(assign).not.toHaveBeenCalled();
  });

  it("GET (PayPal): redirige a la URL de aprobacion", () => {
    const { nav, assign, enviados } = preparar();
    nav.ir("https://paypal.com/checkoutnow?token=A", "A", "GET");
    expect(assign).toHaveBeenCalledWith("https://paypal.com/checkoutnow?token=A");
    expect(enviados.length).toBe(0);
  });
});
