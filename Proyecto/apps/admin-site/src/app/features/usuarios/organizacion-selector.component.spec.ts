import { Component, signal } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { of } from "rxjs";
import { OrganizacionOpcion } from "../../core/models/usuarios.models";
import { OrganizacionSelectorComponent } from "./organizacion-selector.component";
import { UsuariosService } from "./usuarios.service";

const org = (id: number, razonSocial: string): OrganizacionOpcion => ({ id, razonSocial, rut: `7600000${id}-0`, tipo: "proveedor", estado: "activa" });

@Component({
  standalone: true,
  imports: [OrganizacionSelectorComponent],
  template: `<app-organizacion-selector
    idCampo="t-org"
    [valor]="valor()"
    [etiquetaInicial]="etiqueta()"
    (elegida)="elegidas.push($event)"
    (etiquetaResuelta)="resueltas.push($event)"
  />`
})
class HostComponent {
  readonly valor = signal("");
  readonly etiqueta = signal("");
  readonly elegidas: Array<OrganizacionOpcion | null> = [];
  readonly resueltas: string[] = [];
}

describe("OrganizacionSelectorComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let llamadas: Array<{ q?: string; id?: string }>;
  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector("input") as HTMLInputElement;
  // El effect del componente escribe `texto` durante el primer ciclo; la vista lo refleja en el segundo.
  const ciclos = () => {
    fixture.detectChanges();
    fixture.detectChanges();
  };
  const escribir = (v: string) => {
    input().value = v;
    input().dispatchEvent(new Event("input"));
  };

  beforeEach(() => {
    llamadas = [];
    const falso = {
      buscarOrganizaciones: (f: { q?: string; id?: string }) => {
        llamadas.push(f);
        return of({ items: f.id ? [org(Number(f.id), "Resuelta SpA")] : [org(1, "Panadería Sur"), org(2, "Panadería Norte")] });
      }
    };
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: UsuariosService, useValue: falso }] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("busca con debounce, lista opciones accesibles y elige con click", fakeAsync(() => {
    escribir("pan");
    escribir("pana");
    tick(250);
    fixture.detectChanges();
    expect(llamadas).toEqual([{ q: "pana" }]); // un solo pedido pese a dos teclas
    expect(input().getAttribute("role")).toBe("combobox");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    const opciones = el().querySelectorAll('[role="option"]');
    expect(opciones.length).toBe(2);
    (opciones[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(host.elegidas.at(-1)?.id).toBe(2);
    expect(input().value).toBe("Panadería Norte");
    expect(el().querySelector('[role="listbox"]')).toBeNull();
  }));

  it("teclado: flechas mueven, Enter elige, Escape cierra sin elegir", fakeAsync(() => {
    escribir("pana");
    tick(250);
    fixture.detectChanges();
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    fixture.detectChanges();
    expect(host.elegidas.at(-1)?.id).toBe(2);

    escribir("otra");
    tick(250);
    fixture.detectChanges();
    input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    fixture.detectChanges();
    expect(el().querySelector('[role="listbox"]')).toBeNull();
    expect(input().value).toBe("Panadería Norte"); // vuelve a lo elegido, sin texto huerfano
    expect(host.elegidas.length).toBe(1);
  }));

  it("sin etiqueta conocida resuelve el nombre por id y lo informa", () => {
    host.valor.set("9");
    ciclos();
    expect(llamadas).toEqual(jasmine.arrayContaining([{ id: "9" }]));
    expect(input().value).toBe("Resuelta SpA");
    expect(host.resueltas).toEqual(["Resuelta SpA"]);
  });

  it("con etiqueta conocida no consulta, y limpiar emite null", () => {
    host.valor.set("4");
    host.etiqueta.set("Conocida Ltda");
    ciclos();
    expect(llamadas).toEqual([]);
    expect(input().value).toBe("Conocida Ltda");
    (el().querySelector(".limpiar") as HTMLElement).click();
    fixture.detectChanges();
    expect(host.elegidas.at(-1)).toBeNull();
    expect(input().value).toBe("");
  });

  it("si el id externo cambia (p. ej. boton atras) vuelve a resolver el nombre", () => {
    host.valor.set("4");
    host.etiqueta.set("Conocida Ltda");
    ciclos();
    host.etiqueta.set("");
    host.valor.set("5");
    ciclos();
    expect(llamadas).toEqual([{ id: "5" }]);
    expect(input().value).toBe("Resuelta SpA");
    host.valor.set("");
    ciclos();
    expect(input().value).toBe("");
  });
});
