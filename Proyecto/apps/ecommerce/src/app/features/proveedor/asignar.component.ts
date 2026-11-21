import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import {
  CondicionesEntrega,
  ModalidadEntrega,
  OfertaCreada,
  OfertasProveedorService,
  precioMaximo,
  ProductoDisponible
} from "../../core/proveedor/ofertas-proveedor.service";
import { formatearClp, formatearEntero, plazo } from "../../shared/formato";

/** Donde quedaria el precio frente a los demas distribuidores del producto. */
export function posicionFrente(precio: number, otros: number[]): string {
  if (!otros.length) return "Serías el único distribuidor de este producto.";
  const ordenados = [...otros].sort((a, b) => a - b);
  const total = ordenados.length + 1;
  const masBarato = ordenados[0]!;
  if (precio < masBarato) return `Serías el más barato de ${total}: el siguiente cobra ${formatearClp(masBarato)}.`;
  if (precio === masBarato) return `Empatarías con el más barato (${formatearClp(masBarato)}) entre ${total} distribuidores.`;
  const lugar = ordenados.filter((p) => p < precio).length + 1;
  return `Quedarías ${lugar}.º de ${total}: el más barato cobra ${formatearClp(masBarato)} (${formatearClp(precio - masBarato)} menos).`;
}

const ERRORES: Record<string, string> = {
  PRECIO_SOBRE_TOPE: "El precio supera el tope de publicación de la ficha. Bájalo o guárdalo como borrador.",
  OFERTA_DUPLICADA: "Ya tienes una oferta para este producto.",
  PROVEEDOR_NO_ACTIVO: "Tu empresa todavía no está aprobada: puedes guardar borradores, pero no publicar.",
  PRODUCTO_NO_DISPONIBLE: "Ese producto ya no está disponible en el catálogo."
};

// /proveedor/asignar (KAN-102): el proveedor busca un producto del catalogo
// maestro (no crea fichas) y publica sus condiciones: precio, caja, stock,
// minimo, plazo, modalidad y notas. Calcula stock total, valor del stock,
// precio por kg/L y la posicion frente a los demas; el corte, el despacho y
// las zonas son del proveedor (GET /proveedor/cobertura). Sobre el tope de
// la ficha no se publica, pero si se puede guardar como borrador.
@Component({
  selector: "app-asignar-producto",
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./asignar.component.html",
  styleUrl: "./asignar.component.css"
})
export class AsignarProductoComponent {
  private readonly ofertas = inject(OfertasProveedorService);
  private readonly catalogo = inject(CatalogoService);

  readonly q = signal("");
  readonly resultados = signal<ProductoDisponible[]>([]);
  readonly totalResultados = signal(0);
  readonly buscando = signal(false);
  readonly elegido = signal<ProductoDisponible | null>(null);
  readonly preciosOtros = signal<number[]>([]);
  readonly condiciones = signal<CondicionesEntrega | null>(null);

  // Formulario (signals para que los calculos se actualicen al escribir).
  readonly precio = signal<number | null>(null);
  readonly porCaja = signal<number | null>(12);
  readonly cajas = signal<number | null>(null);
  readonly minimo = signal<number | null>(null);
  readonly plazoHoras = signal<number | null>(24);
  readonly modalidad = signal<ModalidadEntrega>("ambos");
  readonly notas = signal("");
  readonly estado = signal<"publicada" | "borrador">("publicada");

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly intentado = signal(false);
  readonly creada = signal<{ resultado: OfertaCreada; producto: ProductoDisponible } | null>(null);

  readonly clp = formatearClp;
  readonly entero = formatearEntero;
  readonly plazo = plazo;
  private espera: ReturnType<typeof setTimeout> | null = null;

  readonly tope = computed(() => {
    const p = this.elegido();
    return p ? precioMaximo(p) : null;
  });
  readonly sobreTope = computed(() => {
    const t = this.tope();
    const p = this.precio();
    return t !== null && p !== null && p > t;
  });
  readonly stockTotal = computed(() => (this.cajas() ?? 0) * (this.porCaja() ?? 0));
  readonly valorStock = computed(() => this.stockTotal() * (this.precio() ?? 0));
  readonly porUnidadDeMedida = computed(() => {
    const p = this.elegido();
    const precio = this.precio();
    if (!p || !precio || !p.contenido) return null;
    return `${formatearClp(Math.round(precio / p.contenido))}/${p.unidad === "unidad" ? "u" : p.unidad}`;
  });
  readonly posicion = computed(() => {
    const precio = this.precio();
    return precio ? posicionFrente(precio, this.preciosOtros()) : null;
  });

  /** Lo que falta para poder enviar, en palabras. */
  readonly faltantes = computed(() => {
    const f: string[] = [];
    if (!this.precio() || this.precio()! < 1) f.push("el precio");
    if (!this.porCaja() || this.porCaja()! < 1) f.push("las unidades por caja");
    if (this.cajas() === null || this.cajas()! < 0) f.push("las cajas disponibles");
    return f;
  });

  constructor() {
    void this.buscar();
    this.ofertas.condicionesEntrega().then((c) => this.condiciones.set(c), () => this.condiciones.set(null));
  }

  alEscribir(q: string): void {
    this.q.set(q);
    if (this.espera) clearTimeout(this.espera);
    this.espera = setTimeout(() => void this.buscar(), 250);
  }

  async buscar(): Promise<void> {
    this.buscando.set(true);
    try {
      const r = await this.ofertas.productosDisponibles(this.q());
      this.resultados.set(r.items);
      this.totalResultados.set(r.total);
    } catch {
      this.resultados.set([]);
      this.totalResultados.set(0);
    } finally {
      this.buscando.set(false);
    }
  }

  async elegir(p: ProductoDisponible): Promise<void> {
    this.elegido.set(p);
    this.creada.set(null);
    this.error.set(null);
    this.intentado.set(false);
    this.precio.set(null);
    this.preciosOtros.set([]);
    try {
      const ficha = await this.catalogo.ficha(p.id);
      if (this.elegido()?.id === p.id) this.preciosOtros.set(ficha.ofertas.map((o) => o.precioUnitario));
    } catch {
      // Sin ofertas publicadas la ficha no esta en el catalogo: seria el primero.
    }
  }

  textoZona(z: CondicionesEntrega["zonas"][number]): string {
    return `${z.comuna ?? `Toda la región ${z.region}`}: ${formatearClp(z.costoDespacho)}${z.plazoHoras ? ` · ${plazo(z.plazoHoras)}` : ""}`;
  }

  async enviar(): Promise<void> {
    const p = this.elegido();
    this.intentado.set(true);
    this.error.set(null);
    if (!p || this.faltantes().length || this.enviando()) return;
    if (this.estado() === "publicada" && this.sobreTope()) {
      this.error.set(ERRORES["PRECIO_SOBRE_TOPE"]!);
      return;
    }
    this.enviando.set(true);
    try {
      const resultado = await this.ofertas.crear({
        productoId: p.id,
        precioUnitario: this.precio()!,
        unidadesPorCaja: this.porCaja()!,
        cajasDisponibles: this.cajas()!,
        ...(this.minimo() ? { minimoCompra: this.minimo()! } : {}),
        ...(this.plazoHoras() ? { plazoHoras: this.plazoHoras()! } : {}),
        modalidadEntrega: this.modalidad(),
        ...(this.notas().trim() ? { notasCliente: this.notas().trim() } : {}),
        estado: this.estado()
      });
      this.creada.set({ resultado, producto: p });
      this.elegido.set(null);
      this.resultados.update((r) => r.filter((x) => x.id !== p.id));
      this.totalResultados.update((t) => Math.max(0, t - 1));
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
      this.error.set((code && ERRORES[code]) ?? "No pudimos guardar la oferta. Revisa los datos e inténtalo de nuevo.");
    } finally {
      this.enviando.set(false);
    }
  }

  otra(): void {
    this.creada.set(null);
    this.estado.set("publicada");
    this.notas.set("");
    this.minimo.set(null);
    this.cajas.set(null);
  }
}
