import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import {
  CambioOferta,
  CambiosOferta,
  EstadoOferta,
  OfertaProveedor,
  OfertasProveedorService,
  precioMaximo
} from "../../core/proveedor/ofertas-proveedor.service";
import { formatearClp, formatearEntero, plazo } from "../../shared/formato";

/** Ofertas publicadas con este numero de cajas o menos se marcan como stock bajo (igual que el panel). */
export const STOCK_BAJO = 20;

const MODALIDAD: Record<OfertaProveedor["modalidadEntrega"], string> = { despacho: "despacho", retiro: "retiro", ambos: "despacho o retiro" };
const FECHA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Etiqueta del estado tal como la ve el proveedor: el stock bajo se nota en las publicadas. */
export function estadoVisible(o: Pick<OfertaProveedor, "estado" | "cajasDisponibles">): { texto: string; tono: "ok" | "aviso" | "neutro" } {
  if (o.estado === "borrador") return { texto: "Borrador", tono: "neutro" };
  if (o.estado === "pausada") return { texto: "Pausada", tono: "neutro" };
  if (o.cajasDisponibles === 0) return { texto: "Sin stock", tono: "aviso" };
  if (o.cajasDisponibles !== null && o.cajasDisponibles <= STOCK_BAJO) return { texto: "Stock bajo", tono: "aviso" };
  return { texto: "Publicada", tono: "ok" };
}

/** "Precio $12.990 → $12.490 · Cajas 40 → 34" */
export function textoCambio(c: CambioOferta): string {
  const partes: string[] = [];
  if (c.precioAnterior === null && c.cajasAnteriores === null) {
    partes.push(`Alta a ${c.precioNuevo !== null ? formatearClp(c.precioNuevo) : "—"}${c.cajasNuevas !== null ? `, ${c.cajasNuevas} cajas` : ""}`);
  } else {
    if (c.precioNuevo !== c.precioAnterior) partes.push(`Precio ${formatearClp(c.precioAnterior ?? 0)} → ${formatearClp(c.precioNuevo ?? 0)}`);
    if (c.cajasNuevas !== c.cajasAnteriores) partes.push(`Cajas ${c.cajasAnteriores ?? "—"} → ${c.cajasNuevas ?? "—"}`);
  }
  return partes.join(" · ") || "Sin cambios de precio ni stock";
}

const ERRORES: Record<string, string> = {
  PRECIO_SOBRE_TOPE: "Ese precio supera el tope de publicación de la ficha.",
  PROVEEDOR_NO_ACTIVO: "Tu empresa todavía no está aprobada para publicar.",
  OFERTA_NO_ELIMINABLE: "Solo se borran borradores sin ventas; una oferta publicada se pausa."
};

// /proveedor/productos (KAN-103): las ofertas del proveedor en una tabla
// (producto, formato, precio, unitario, cajas, unidades, despacho, minimo,
// estado), con filtros. Editar precio y stock (con motivo), pausar y
// reactivar, publicar un borrador o borrarlo. Cada cambio de precio o stock
// queda en oferta_precio_historial (lo hace el backend en la misma
// transaccion) y se ve en "Historial" de la oferta.
@Component({
  selector: "app-mis-productos",
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: "./productos.component.html",
  styleUrl: "./productos.component.css"
})
export class MisProductosComponent {
  private readonly servicio = inject(OfertasProveedorService);

  readonly ofertas = signal<OfertaProveedor[]>([]);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly filtro = signal<EstadoOferta | null>(null);
  readonly q = signal("");

  // Edicion (una oferta a la vez).
  readonly editando = signal<number | null>(null);
  readonly precio = signal<number | null>(null);
  readonly cajas = signal<number | null>(null);
  readonly motivo = signal("");
  readonly historial = signal<CambioOferta[] | null>(null);
  readonly guardando = signal<number | null>(null);
  readonly error = signal<{ ofertaId: number; texto: string } | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly clp = formatearClp;
  readonly entero = formatearEntero;
  readonly plazo = plazo;
  readonly estadoVisible = estadoVisible;
  readonly textoCambio = textoCambio;
  readonly fecha = (iso: string) => FECHA.format(new Date(iso));

  readonly filtros: Array<{ estado: EstadoOferta | null; etiqueta: string }> = [
    { estado: null, etiqueta: "Todas" },
    { estado: "publicada", etiqueta: "Publicadas" },
    { estado: "pausada", etiqueta: "Pausadas" },
    { estado: "borrador", etiqueta: "Borradores" }
  ];

  readonly visibles = computed(() => {
    const f = this.filtro();
    const q = this.q().trim().toLowerCase();
    return this.ofertas()
      .filter((o) => !f || o.estado === f)
      .filter((o) => !q || o.producto.nombre.toLowerCase().includes(q) || o.producto.sku.toLowerCase().includes(q))
      .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
  });
  readonly conteo = computed(() => {
    const t = { publicada: 0, pausada: 0, borrador: 0 };
    for (const o of this.ofertas()) t[o.estado]++;
    return t;
  });

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      this.ofertas.set((await this.servicio.listar({ tamano: 100 })).items);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  unitario(o: OfertaProveedor): string {
    const c = o.producto.contenido;
    if (!c) return "—";
    return `${formatearClp(Math.round(o.precioUnitario / c))}/${o.producto.unidad === "unidad" ? "u" : o.producto.unidad}`;
  }

  unidades(o: OfertaProveedor): string {
    if (o.cajasDisponibles === null) return "—";
    return `${formatearEntero(o.cajasDisponibles * (o.unidadesPorCaja ?? 1))} un.`;
  }

  despacho(o: OfertaProveedor): string {
    return `${plazo(o.plazoHoras)} · ${MODALIDAD[o.modalidadEntrega]}`;
  }

  tope(o: OfertaProveedor): number | null {
    return precioMaximo(o.producto);
  }

  async editar(o: OfertaProveedor): Promise<void> {
    if (this.editando() === o.id) return this.cerrar();
    this.editando.set(o.id);
    this.precio.set(o.precioUnitario);
    this.cajas.set(o.cajasDisponibles);
    this.motivo.set("");
    this.error.set(null);
    this.historial.set(null);
    try {
      const h = await this.servicio.historial(o.id);
      if (this.editando() === o.id) this.historial.set(h);
    } catch {
      if (this.editando() === o.id) this.historial.set([]);
    }
  }

  cerrar(): void {
    this.editando.set(null);
    this.historial.set(null);
    this.error.set(null);
  }

  /** Se publica (o queda publicada) sobre el tope: el backend lo rechazaria. */
  sobreTope(o: OfertaProveedor): boolean {
    const t = this.tope(o);
    return t !== null && (this.precio() ?? 0) > t && o.estado === "publicada";
  }

  async guardar(o: OfertaProveedor): Promise<void> {
    const cambios: CambiosOferta = {};
    if (this.precio() !== null && this.precio() !== o.precioUnitario) cambios.precioUnitario = this.precio()!;
    if (this.cajas() !== null && this.cajas() !== o.cajasDisponibles) cambios.cajasDisponibles = this.cajas()!;
    if (!Object.keys(cambios).length) return this.cerrar();
    if (this.motivo().trim()) cambios.motivo = this.motivo().trim();
    await this.aplicar(o, cambios, "Guardado. El cambio quedó en el historial de la oferta.");
  }

  pausar(o: OfertaProveedor): Promise<void> {
    return this.aplicar(o, { estado: "pausada" }, `${o.producto.nombre} quedó pausada: ya no se muestra a los compradores.`);
  }

  reactivar(o: OfertaProveedor): Promise<void> {
    return this.aplicar(o, { estado: "publicada" }, `${o.producto.nombre} está publicada otra vez.`);
  }

  publicar(o: OfertaProveedor): Promise<void> {
    return this.aplicar(o, { estado: "publicada" }, `${o.producto.nombre} está publicada.`);
  }

  async eliminar(o: OfertaProveedor): Promise<void> {
    if (this.guardando() !== null) return;
    this.guardando.set(o.id);
    this.error.set(null);
    try {
      await this.servicio.eliminar(o.id);
      this.ofertas.update((l) => l.filter((x) => x.id !== o.id));
      this.aviso.set(`Borraste el borrador de ${o.producto.nombre}.`);
      this.cerrar();
    } catch (err) {
      this.error.set({ ofertaId: o.id, texto: this.mensaje(err) });
    } finally {
      this.guardando.set(null);
    }
  }

  private async aplicar(o: OfertaProveedor, cambios: CambiosOferta, ok: string): Promise<void> {
    if (this.guardando() !== null) return;
    this.guardando.set(o.id);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const r = await this.servicio.actualizar(o.id, cambios);
      this.ofertas.update((l) => l.map((x) => (x.id === o.id ? { ...x, ...r.oferta, producto: x.producto } : x)));
      this.aviso.set(r.revisionPrecio ? `${ok} El precio supera el tope: el equipo de Cotizapp lo revisará.` : ok);
      if (this.editando() === o.id) {
        if (cambios.precioUnitario !== undefined || cambios.cajasDisponibles !== undefined) {
          this.historial.set(await this.servicio.historial(o.id).catch(() => this.historial()));
          this.motivo.set("");
        }
      }
    } catch (err) {
      this.error.set({ ofertaId: o.id, texto: this.mensaje(err) });
    } finally {
      this.guardando.set(null);
    }
  }

  private mensaje(err: unknown): string {
    const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
    return (code && ERRORES[code]) ?? "No pudimos guardar el cambio. Inténtalo de nuevo.";
  }
}
