import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { EstadoEnvio, VentaProveedor, VentasProveedorService } from "../../core/proveedor/ventas-proveedor.service";
import { formatearClp, formatearEntero } from "../../shared/formato";

const TAMANO = 50;
const FECHA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });

export const ESTADOS_ENVIO: Record<EstadoEnvio, { texto: string; filtro: string; tono: "accion" | "curso" | "ok" | "neutro" }> = {
  por_despachar: { texto: "Por despachar", filtro: "Por despachar", tono: "accion" },
  en_preparacion: { texto: "En preparación", filtro: "En preparación", tono: "curso" },
  listo_retiro: { texto: "Listo para retiro", filtro: "Listos para retiro", tono: "curso" },
  despachado: { texto: "Despachado", filtro: "Despachados", tono: "curso" },
  entregado: { texto: "Entregado", filtro: "Entregados", tono: "ok" },
  cancelado: { texto: "Cancelado", filtro: "Cancelados", tono: "neutro" }
};

/** Texto del boton que lleva el envio a `siguiente`. */
export function textoAccion(siguiente: EstadoEnvio): string {
  switch (siguiente) {
    case "en_preparacion":
      return "Preparar";
    case "despachado":
      return "Marcar despachado";
    case "listo_retiro":
      return "Marcar listo para retiro";
    case "entregado":
      return "Marcar entregado";
    default:
      return ESTADOS_ENVIO[siguiente].texto;
  }
}

const ERRORES: Record<string, string> = {
  TRANSICION_INVALIDA: "Ese envío ya cambió de estado. Actualizamos la lista.",
  ORDEN_REEMBOLSADA: "La orden fue reembolsada: el envío ya no se mueve.",
  ORDEN_NO_PAGADA: "La orden todavía no está pagada.",
  ENVIO_NO_ENCONTRADO: "No encontramos ese envío."
};

// /proveedor/ventas (KAN-105): los envios del proveedor, uno por orden, con
// folio, cliente, comuna, fecha, lineas, cajas, monto y estado. Filtros por
// estado con su conteo y un boton por fila para avanzar el envio: preparar,
// despachar (o dejar listo para retiro) y entregar. El proveedor solo ve su
// tramo: sus lineas y su monto, nunca el total de la orden.
@Component({
  selector: "app-ventas-proveedor",
  standalone: true,
  templateUrl: "./ventas.component.html",
  styleUrl: "./ventas.component.css"
})
export class VentasProveedorComponent {
  private readonly servicio = inject(VentasProveedorService);

  readonly ventas = signal<VentaProveedor[]>([]);
  readonly conteo = signal<Partial<Record<EstadoEnvio, number>>>({});
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly filtro = signal<EstadoEnvio | null>(null);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly cargandoMas = signal(false);
  readonly moviendo = signal<number | null>(null);
  readonly error = signal<{ envioId: number; texto: string } | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly clp = formatearClp;
  readonly entero = formatearEntero;
  readonly estados = ESTADOS_ENVIO;
  readonly textoAccion = textoAccion;
  readonly fecha = (iso: string) => FECHA.format(new Date(iso)).replace(".", "");

  readonly filtros = computed(() => {
    const c = this.conteo();
    const todas = Object.values(c).reduce((t, n) => t + (n ?? 0), 0);
    const lista: Array<{ estado: EstadoEnvio | null; etiqueta: string; n: number }> = [{ estado: null, etiqueta: "Todas", n: todas }];
    for (const e of Object.keys(ESTADOS_ENVIO) as EstadoEnvio[]) {
      // Los estados sin envios no se muestran, salvo el que esta elegido.
      if ((c[e] ?? 0) > 0 || this.filtro() === e) lista.push({ estado: e, etiqueta: ESTADOS_ENVIO[e].filtro, n: c[e] ?? 0 });
    }
    return lista;
  });
  readonly resumen = computed(() => {
    const c = this.conteo();
    const todas = Object.values(c).reduce((t, n) => t + (n ?? 0), 0);
    const pendientes = c.por_despachar ?? 0;
    return `${todas} ${todas === 1 ? "orden" : "órdenes"}${pendientes ? ` · ${pendientes} por despachar` : ""}`;
  });
  readonly hayMas = computed(() => this.ventas().length < this.total());

  constructor() {
    void this.cargar();
  }

  filtrar(estado: EstadoEnvio | null): void {
    if (this.filtro() === estado) return;
    this.filtro.set(estado);
    this.aviso.set(null);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    this.error.set(null);
    try {
      const r = await this.servicio.listar({ estado: this.filtro(), pagina: 1, tamano: TAMANO });
      this.ventas.set(r.items);
      this.conteo.set(r.conteo);
      this.total.set(r.total);
      this.pagina.set(1);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  async verMas(): Promise<void> {
    if (this.cargandoMas()) return;
    this.cargandoMas.set(true);
    try {
      const r = await this.servicio.listar({ estado: this.filtro(), pagina: this.pagina() + 1, tamano: TAMANO });
      const vistos = new Set(this.ventas().map((v) => v.envioId));
      this.ventas.update((l) => [...l, ...r.items.filter((v) => !vistos.has(v.envioId))]);
      this.total.set(r.total);
      this.pagina.update((p) => p + 1);
    } catch {
      this.aviso.set("No pudimos cargar más órdenes. Inténtalo de nuevo.");
    } finally {
      this.cargandoMas.set(false);
    }
  }

  async avanzar(v: VentaProveedor): Promise<void> {
    if (!v.siguiente || this.moviendo() !== null) return;
    const destino = v.siguiente;
    this.moviendo.set(v.envioId);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await this.servicio.cambiarEstado(v.envioId, destino);
      this.aviso.set(`${v.folio} · ${v.cliente}: ${ESTADOS_ENVIO[destino].texto.toLowerCase()}.`);
      await this.recargarSinParpadeo();
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
      this.error.set({ envioId: v.envioId, texto: (code && ERRORES[code]) ?? "No pudimos cambiar el estado. Inténtalo de nuevo." });
      if (code === "TRANSICION_INVALIDA") await this.recargarSinParpadeo(v.envioId);
    } finally {
      this.moviendo.set(null);
    }
  }

  /** Vuelve a pedir lo que ya se ve (estado y conteos cambiaron) sin pasar por "cargando". */
  private async recargarSinParpadeo(mantenerError?: number): Promise<void> {
    try {
      const r = await this.servicio.listar({ estado: this.filtro(), pagina: 1, tamano: Math.min(100, TAMANO * this.pagina()) });
      this.ventas.set(r.items);
      this.conteo.set(r.conteo);
      this.total.set(r.total);
      if (mantenerError === undefined) this.error.set(null);
    } catch {
      // La lista queda como estaba; el aviso o el error ya dicen que paso.
    }
  }
}
