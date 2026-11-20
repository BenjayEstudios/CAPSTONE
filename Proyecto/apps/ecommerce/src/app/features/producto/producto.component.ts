import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, effect, inject, signal, untracked } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AnaliticaService } from "../../core/analitica/analitica.service";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import { FichaProducto, OfertaFicha, OrigenVisita } from "../../core/models/catalogo.models";
import { CarroState } from "../../core/state/carro.state";
import { SessionState } from "../../core/state/session.state";
import { formatearClp, plazo } from "../../shared/formato";

/** Cajas que hay que pedir para cumplir el minimo de compra (en unidades); al menos 1. */
export function cajasMinimas(o: Pick<OfertaFicha, "minimoCompra" | "unidadesPorCaja">): number {
  if (!o.minimoCompra) return 1;
  return Math.max(1, Math.ceil(o.minimoCompra / (o.unidadesPorCaja ?? 1)));
}

export interface Aviso {
  tipo: "ok" | "error";
  texto: string;
  conEnlaceCarro?: boolean;
}

// /producto/:id (KAN-92 y KAN-93): ficha unica del producto con el
// comparador de distribuidores, en tabla (todos, por precio unitario) o lado a
// lado (los 3 mas baratos). "Comprar" agrega esa oferta al carro. Registra
// vista_producto al abrir y click_oferta al comprar.
@Component({
  selector: "app-producto",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./producto.component.html",
  styleUrl: "./producto.component.css"
})
export class ProductoComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogo = inject(CatalogoService);
  private readonly analitica = inject(AnaliticaService);
  private readonly carro = inject(CarroState);
  readonly session = inject(SessionState);
  private readonly params = toSignal(this.ruta.paramMap, { requireSync: true });
  private readonly query = toSignal(this.ruta.queryParamMap, { requireSync: true });

  readonly id = computed(() => Number(this.params().get("id")));
  readonly vista = computed(() => (this.query().get("vista") === "lado" ? "lado" : "tabla"));
  readonly ficha = signal<FichaProducto | null>(null);
  readonly estado = signal<"cargando" | "ok" | "no-encontrado" | "error">("cargando");
  readonly comprando = signal<number | null>(null);
  readonly aviso = signal<Aviso | null>(null);

  readonly masBarata = computed(() => this.ficha()?.ofertas[0] ?? null);
  readonly masCara = computed(() => this.ficha()?.ofertas.at(-1) ?? null);
  readonly diferencia = computed(() => (this.masCara()?.precioUnitario ?? 0) - (this.masBarata()?.precioUnitario ?? 0));
  readonly tresMasBaratas = computed(() => this.ficha()?.ofertas.slice(0, 3) ?? []);

  readonly clp = formatearClp;
  readonly plazo = plazo;
  readonly cajasMinimas = cajasMinimas;
  private vistaRegistrada: number | null = null;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.cargar(id));
    });
  }

  async cargar(id = this.id()): Promise<void> {
    this.estado.set("cargando");
    this.aviso.set(null);
    try {
      const f = await this.catalogo.ficha(id);
      this.ficha.set(f);
      this.estado.set("ok");
      if (this.vistaRegistrada !== id) {
        this.vistaRegistrada = id;
        const origen = this.query().get("origen");
        this.analitica.vistaProducto(id, (["catalogo", "busqueda"].includes(origen ?? "") ? origen : "directo") as OrigenVisita);
      }
    } catch (err) {
      this.estado.set(err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400) ? "no-encontrado" : "error");
    }
  }

  cambiarVista(v: "tabla" | "lado"): void {
    void this.router.navigate([], { queryParams: { vista: v === "lado" ? "lado" : null }, queryParamsHandling: "merge", replaceUrl: true });
  }

  /** Precio por kg/L de la oferta: "$2.498/L". */
  porUnidad(o: OfertaFicha): string {
    return o.precioNormalizado ? `${this.clp(o.precioNormalizado.valor)}/${o.precioNormalizado.por === "unidad" ? "u" : o.precioNormalizado.por}` : "—";
  }

  /** Como llega: costo de despacho a tu zona, gratis desde, o solo retiro. */
  despacho(o: OfertaFicha): string {
    if (o.modalidadEntrega === "retiro") return "Solo retiro";
    if (o.proveedor.costoDespacho === null) return o.modalidadEntrega === "ambos" ? "Retiro (no despacha a tu zona)" : "No despacha a tu zona";
    return `Despacho ${this.clp(o.proveedor.costoDespacho)}`;
  }

  async comprar(o: OfertaFicha): Promise<void> {
    const ficha = this.ficha();
    if (!ficha || this.comprando()) return;
    this.analitica.clickOferta(ficha.id, o.id);
    if (!this.session.autenticado()) {
      void this.router.navigate(["/ingresar"], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (!this.session.esComprador()) {
      this.aviso.set({ tipo: "error", texto: "Las compras se hacen con una cuenta de comprador." });
      return;
    }
    const cajas = cajasMinimas(o);
    this.comprando.set(o.id);
    this.aviso.set(null);
    try {
      await this.carro.agregar(o.id, cajas, o.precioUnitario);
      this.aviso.set({
        tipo: "ok",
        texto: `Agregaste ${cajas} ${cajas === 1 ? "caja" : "cajas"} de ${ficha.nombre} de ${o.proveedor.nombre}.`,
        conEnlaceCarro: true
      });
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
      this.aviso.set({
        tipo: "error",
        texto: code === "OFERTA_NO_DISPONIBLE" || code === "OFERTA_NO_ENCONTRADA"
          ? "Esa oferta ya no está disponible. Recarga la página para ver los precios de hoy."
          : "No pudimos agregarlo al carro. Inténtalo de nuevo."
      });
    } finally {
      this.comprando.set(null);
    }
  }
}
