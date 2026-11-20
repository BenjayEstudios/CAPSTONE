import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { EMPTY, Subject, catchError, debounceTime, finalize, switchMap, tap } from "rxjs";
import { OrganizacionOpcion } from "../../core/models/usuarios.models";
import { UsuariosService } from "./usuarios.service";

/**
 * Selector de organizacion con busqueda (combobox, patron ARIA 1.2).
 * No carga el catalogo: cada busqueda trae como maximo 20 coincidencias (nombre o RUT), asi que
 * funciona igual con 10 organizaciones que con 100 mil. Cancela las busquedas obsoletas.
 */
@Component({
  selector: "app-organizacion-selector",
  standalone: true,
  templateUrl: "./organizacion-selector.component.html",
  styleUrl: "./organizacion-selector.component.css"
})
export class OrganizacionSelectorComponent {
  private readonly svc = inject(UsuariosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly busqueda$ = new Subject<string>();

  /** id elegido ("" = ninguna). */
  readonly valor = input<string>("");
  /** Nombre ya conocido de `valor`, para no consultarlo (p. ej. al editar un usuario). */
  readonly etiquetaInicial = input<string>("");
  readonly idCampo = input.required<string>();
  readonly placeholder = input<string>("Buscar por nombre o RUT…");
  readonly deshabilitado = input<boolean>(false);

  readonly elegida = output<OrganizacionOpcion | null>();
  /** Se emite al resolver el nombre de un `valor` que llego sin etiqueta (p. ej. desde la URL). */
  readonly etiquetaResuelta = output<string>();

  readonly texto = signal("");
  readonly abierto = signal(false);
  readonly opciones = signal<OrganizacionOpcion[]>([]);
  readonly activa = signal(-1);
  readonly cargando = signal(false);
  readonly errorBusqueda = signal(false);
  private etiquetaElegida = "";
  private idMostrado = "";

  constructor() {
    this.busqueda$
      .pipe(
        debounceTime(250),
        tap(() => {
          this.cargando.set(true);
          this.errorBusqueda.set(false);
        }),
        // switchMap cancela la peticion anterior: una respuesta lenta no pisa a una mas nueva.
        switchMap((q) =>
          this.svc.buscarOrganizaciones({ q }).pipe(
            catchError(() => {
              this.errorBusqueda.set(true);
              this.opciones.set([]);
              return EMPTY;
            }),
            finalize(() => this.cargando.set(false))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((r) => {
        this.opciones.set(r.items);
        this.activa.set(r.items.length ? 0 : -1);
      });

    // Sincroniza el texto mostrado con el valor externo (URL, formulario, limpiar filtros).
    effect(() => {
      const id = this.valor();
      const etiqueta = this.etiquetaInicial();
      untracked(() => {
        if (!id) {
          this.idMostrado = "";
          this.etiquetaElegida = "";
          this.texto.set("");
        } else if (etiqueta) {
          this.idMostrado = id;
          this.etiquetaElegida = etiqueta;
          this.texto.set(etiqueta);
        } else if (id !== this.idMostrado) {
          this.idMostrado = id;
          this.svc.buscarOrganizaciones({ id }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (r) => {
              const nombre = r.items[0]?.razonSocial ?? "";
              this.etiquetaElegida = nombre;
              this.texto.set(nombre);
              if (nombre) this.etiquetaResuelta.emit(nombre);
            },
            error: () => undefined
          });
        }
      });
    });
  }

  idOpcion(i: number): string {
    return `${this.idCampo()}-op-${i}`;
  }

  onInput(v: string): void {
    this.texto.set(v);
    this.abrir();
    this.busqueda$.next(v);
  }

  abrir(): void {
    if (this.deshabilitado()) return;
    if (!this.abierto()) {
      this.abierto.set(true);
      // Primera apertura: muestra las primeras organizaciones para poder explorar sin escribir.
      if (this.opciones().length === 0) this.busqueda$.next(this.texto() === this.etiquetaElegida ? "" : this.texto());
    }
  }

  onTecla(e: KeyboardEvent): void {
    const n = this.opciones().length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!this.abierto()) this.abrir();
        else if (n) this.activa.set((this.activa() + 1) % n);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (n) this.activa.set((this.activa() - 1 + n) % n);
        break;
      case "Enter": {
        const o = this.opciones()[this.activa()];
        if (this.abierto() && o) {
          e.preventDefault();
          this.elegir(o);
        }
        break;
      }
      case "Escape":
        if (this.abierto()) {
          e.preventDefault();
          e.stopPropagation();
          this.cerrar();
        }
        break;
    }
  }

  elegir(o: OrganizacionOpcion): void {
    this.idMostrado = String(o.id);
    this.etiquetaElegida = o.razonSocial;
    this.texto.set(o.razonSocial);
    this.elegida.emit(o);
    this.abierto.set(false);
  }

  limpiar(): void {
    this.idMostrado = "";
    this.etiquetaElegida = "";
    this.texto.set("");
    this.opciones.set([]);
    this.elegida.emit(null);
    this.abierto.set(false);
  }

  /** Al salir del campo sin elegir, vuelve al ultimo valor elegido (no queda texto huerfano). */
  onBlur(): void {
    this.abierto.set(false);
    this.texto.set(this.etiquetaElegida);
    this.opciones.set([]);
  }

  private cerrar(): void {
    this.abierto.set(false);
    this.texto.set(this.etiquetaElegida);
  }
}
