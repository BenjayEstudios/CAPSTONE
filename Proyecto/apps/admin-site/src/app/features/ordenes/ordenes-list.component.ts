import { DatePipe } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { DocumentoOrden, OrdenDetalle, OrdenEstado, OrdenResumen } from "../../core/models/ordenes.models";
import { OrdenesService } from "./ordenes.service";
import {
  ETIQUETA_ESTADO_ENVIO, ETIQUETA_ESTADO_ORDEN, ETIQUETA_ESTADO_SII, formatoClp, formatoPct, formatoPlazo,
  medioPagoEtiqueta, mensajeErrorDocumentos, mensajeErrorOrdenes, totalesEnvios
} from "./ordenes.util";

const TAMANO = 20;

@Component({
  selector: "app-ordenes-list",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./ordenes-list.component.html",
  styleUrl: "./ordenes-list.component.css"
})
export class OrdenesListComponent {
  private readonly svc = inject(OrdenesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private solicitud = 0;
  private solicitudDetalle = 0;
  private solicitudDocs = 0;

  readonly estados = Object.keys(ETIQUETA_ESTADO_ORDEN) as OrdenEstado[];
  readonly etiquetaOrden = ETIQUETA_ESTADO_ORDEN;
  readonly etiquetaEnvio = ETIQUETA_ESTADO_ENVIO;
  readonly etiquetaSii = ETIQUETA_ESTADO_SII;
  readonly clp = formatoClp;
  readonly pct = formatoPct;
  readonly plazo = formatoPlazo;
  readonly medio = medioPagoEtiqueta;

  readonly items = signal<OrdenResumen[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);
  readonly pagina = signal(1);
  readonly estado = signal("");
  readonly seleccionadoId = signal<number | null>(null);

  readonly detalle = signal<OrdenDetalle | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly errorDetalle = signal<string | null>(null);
  readonly totales = computed(() => {
    const d = this.detalle();
    return d ? totalesEnvios(d.envios) : null;
  });

  // Documentos tributarios simulados de la orden seleccionada (KAN-153).
  readonly documentos = signal<DocumentoOrden[]>([]);
  readonly cargandoDocs = signal(false);
  readonly errorDocs = signal<string | null>(null);
  readonly emitiendo = signal(false);
  readonly avisoDocs = signal<string | null>(null);
  /** Solo una orden pagada admite emision de documentos. */
  readonly puedeEmitir = computed(() => this.detalle()?.estadoPago === "pagado");

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.estado.set(p.get("estado") ?? "");
      this.pagina.set(Math.max(1, Number(p.get("pagina")) || 1));
      const sel = Number(p.get("orden")) || null;
      const cambioSel = sel !== this.seleccionadoId();
      this.seleccionadoId.set(sel);
      this.cargar();
      if (cambioSel) this.cargarDetalle();
    });
  }

  onEstado(v: string): void {
    this.navegar({ estado: v || null, pagina: null });
  }
  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas() || n === this.pagina()) return;
    this.navegar({ pagina: n === 1 ? null : n });
  }
  seleccionar(id: number): void {
    this.navegar({ orden: id });
  }
  cerrarDetalle(): void {
    this.navegar({ orden: null });
  }
  reintentar(): void {
    this.cargar();
  }
  reintentarDetalle(): void {
    this.cargarDetalle();
  }
  reintentarDocumentos(): void {
    this.cargarDocumentos();
  }

  emitirDocumentos(): void {
    const sel = this.seleccionadoId();
    if (sel === null || this.emitiendo()) return;
    this.emitiendo.set(true);
    this.errorDocs.set(null);
    this.avisoDocs.set(null);
    this.svc.emitirDocumentos(sel).subscribe({
      next: (r) => {
        if (sel !== this.seleccionadoId()) return;
        this.documentos.set(r.documentos);
        this.avisoDocs.set(r.nuevos > 0 ? `Se emitieron ${r.nuevos} documento(s) simulado(s).` : "La orden ya tenía todos sus documentos.");
        this.emitiendo.set(false);
      },
      error: (e) => {
        this.errorDocs.set(mensajeErrorDocumentos(e));
        this.emitiendo.set(false);
      }
    });
  }

  verPdf(doc: DocumentoOrden): void {
    this.errorDocs.set(null);
    this.svc.pdf(doc.pdfUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => this.errorDocs.set(mensajeErrorDocumentos(e))
    });
  }

  private navegar(params: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: "merge" });
  }

  private cargar(): void {
    const id = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(null);
    this.svc.listar({ estado: this.estado(), pagina: this.pagina(), tamano: TAMANO }).subscribe({
      next: (r) => {
        if (id !== this.solicitud) return;
        this.items.set(r.items);
        this.total.set(r.total);
        this.totalPaginas.set(r.totalPaginas);
        this.cargando.set(false);
      },
      error: (e) => {
        if (id !== this.solicitud) return;
        this.items.set([]);
        this.error.set(mensajeErrorOrdenes(e));
        this.cargando.set(false);
      }
    });
  }

  private cargarDocumentos(): void {
    const sel = this.seleccionadoId();
    if (sel === null) return;
    const id = ++this.solicitudDocs;
    this.cargandoDocs.set(true);
    this.errorDocs.set(null);
    this.svc.documentos(sel).subscribe({
      next: (r) => {
        if (id !== this.solicitudDocs) return;
        this.documentos.set(r.items);
        this.cargandoDocs.set(false);
      },
      error: (e) => {
        if (id !== this.solicitudDocs) return;
        this.errorDocs.set(mensajeErrorDocumentos(e));
        this.cargandoDocs.set(false);
      }
    });
  }

  private cargarDetalle(): void {
    const sel = this.seleccionadoId();
    const id = ++this.solicitudDetalle;
    this.detalle.set(null);
    this.errorDetalle.set(null);
    this.documentos.set([]);
    this.errorDocs.set(null);
    this.avisoDocs.set(null);
    if (sel === null) {
      this.cargandoDetalle.set(false);
      return;
    }
    this.cargandoDetalle.set(true);
    this.cargarDocumentos();
    this.svc.obtener(sel).subscribe({
      next: (d) => {
        if (id !== this.solicitudDetalle) return;
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
      },
      error: (e) => {
        if (id !== this.solicitudDetalle) return;
        this.errorDetalle.set(mensajeErrorOrdenes(e));
        this.cargandoDetalle.set(false);
      }
    });
  }
}
