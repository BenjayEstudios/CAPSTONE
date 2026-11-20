import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import { FichaProducto } from "../../core/models/catalogo.models";
import { CarroState } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { cajas } from "../../shared/compra";
import { formatearClp, plazo } from "../../shared/formato";
import { armarCarro, LineaCarro } from "./carro.calculo";

// /carro (KAN-94): un solo carro con ofertas de varios distribuidores,
// agrupado por distribuidor con su plazo, subtotal y despacho. Cambia
// cantidades respetando el minimo, quita lineas, avisa si un precio cambio
// desde que se agrego y resume productos, despachos, ahorro y total.
@Component({
  selector: "app-carro",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./carro.component.html",
  styleUrl: "./carro.component.css"
})
export class CarroComponent {
  readonly carro = inject(CarroState);
  readonly session = inject(SessionState);
  private readonly catalogo = inject(CatalogoService);
  private readonly router = inject(Router);

  /** Fichas de los productos del carro, por productoId. */
  readonly fichas = signal<ReadonlyMap<number, FichaProducto>>(new Map());
  readonly guardando = signal<number | "todo" | null>(null);
  readonly error = signal<string | null>(null);

  readonly resumen = computed(() => armarCarro(this.carro.items(), this.fichas()));

  readonly clp = formatearClp;
  readonly plazo = plazo;
  readonly cajas = cajas;

  constructor() {
    // El carro se recarga al entrar: puede haber cambiado en otra pestana o en la app.
    void this.carro.recargar();
    effect(() => {
      const ids = [...new Set(this.carro.items().map((i) => i.productoId).filter((id): id is number => id !== null))];
      untracked(() => void this.cargarFichas(ids));
    });
  }

  private async cargarFichas(ids: number[]): Promise<void> {
    const faltan = ids.filter((id) => !this.fichas().has(id));
    if (!faltan.length) return;
    const leidas = await Promise.allSettled(faltan.map((id) => this.catalogo.ficha(id)));
    const mapa = new Map(this.fichas());
    // Un producto que ya no esta publicado da 404: su linea se muestra con lo que trae el carro.
    leidas.forEach((r) => r.status === "fulfilled" && mapa.set(r.value.id, r.value));
    this.fichas.set(mapa);
  }

  private async ejecutar(clave: number | "todo", accion: () => Promise<void>): Promise<void> {
    if (this.guardando() !== null) return;
    this.guardando.set(clave);
    this.error.set(null);
    try {
      await accion();
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
      this.error.set(
        code === "OFERTA_NO_DISPONIBLE" || code === "OFERTA_NO_ENCONTRADA"
          ? "Hay productos que ya no están disponibles. Quítalos para poder cambiar el carro."
          : "No pudimos actualizar el carro. Inténtalo de nuevo."
      );
      await this.carro.recargar();
    } finally {
      this.guardando.set(null);
    }
  }

  puedeBajar(l: LineaCarro): boolean {
    return l.disponible && l.cantidad > l.minCajas;
  }

  puedeSubir(l: LineaCarro): boolean {
    return l.disponible && (l.cajasDisponibles === null || l.cantidad < l.cajasDisponibles);
  }

  menos(l: LineaCarro): Promise<void> {
    return this.puedeBajar(l) ? this.ejecutar(l.ofertaId, () => this.carro.cambiarCantidad(l.ofertaId, l.cantidad - 1)) : Promise.resolve();
  }

  mas(l: LineaCarro): Promise<void> {
    return this.puedeSubir(l) ? this.ejecutar(l.ofertaId, () => this.carro.cambiarCantidad(l.ofertaId, l.cantidad + 1)) : Promise.resolve();
  }

  /** Lleva la linea a lo que hay en stock (o al minimo, si quedo bajo el). */
  ajustar(l: LineaCarro): Promise<void> {
    const objetivo = l.sinStock ? l.cajasDisponibles! : l.minCajas;
    return this.ejecutar(l.ofertaId, () => this.carro.cambiarCantidad(l.ofertaId, objetivo));
  }

  quitar(l: LineaCarro): Promise<void> {
    return this.ejecutar(l.ofertaId, () => this.carro.quitar(l.ofertaId));
  }

  quitarNoDisponibles(): Promise<void> {
    return this.ejecutar("todo", () => this.carro.quitar(...this.resumen().noDisponibles.map((l) => l.ofertaId)));
  }

  aceptarPrecios(): Promise<void> {
    return this.ejecutar("todo", () => this.carro.aceptarPrecios());
  }

  irAlPago(): void {
    if (!this.resumen().bloqueos.length) void this.router.navigate(["/checkout"]);
  }

  nombresNoDisponibles(): string {
    return this.resumen().noDisponibles.map((l) => l.nombre).join(", ");
  }

  /** "Caja 1 L · mínimo 12 un. · 12 un. por caja". */
  detalle(l: LineaCarro): string {
    const partes = [l.formato, l.minimoCompra ? `mínimo ${l.minimoCompra} un.` : "sin mínimo", l.unidadesPorCaja ? `${l.unidadesPorCaja} un. por caja` : null];
    return partes.filter(Boolean).join(" · ");
  }
}
