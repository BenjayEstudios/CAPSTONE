import { DatePipe } from "@angular/common";
import { Component, DestroyRef, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  EstadoLiquidacion, Liquidacion, LiquidacionDetalle, ResultadoGeneracion
} from "../../core/models/liquidaciones.models";
import { ProveedorListadoItem } from "../../core/models/proveedores.models";
import { SessionState } from "../../core/state/session.state";
import { ProveedoresService } from "../proveedores/proveedores.service";
import { LiquidacionesService } from "./liquidaciones.service";
import {
  ETIQUETA_ESTADO, clp, fechaCorta, hoyYmd, mensajeErrorLiquidaciones, semanaAnteriorYmd, validarFechaPago, validarRango
} from "./liquidaciones.util";

const TAMANO = 20;

@Component({
  selector: "app-liquidaciones-lista",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./liquidaciones-lista.component.html",
  styleUrl: "./liquidaciones-lista.component.css"
})
export class LiquidacionesListaComponent {
  private readonly svc = inject(LiquidacionesService);
  private readonly proveedoresSvc = inject(ProveedoresService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sesion = inject(SessionState);
  private solicitud = 0;
  private solicitudDetalle = 0;

  readonly estados = Object.keys(ETIQUETA_ESTADO) as EstadoLiquidacion[];
  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly clp = clp;
  readonly fechaCorta = fechaCorta;

  readonly items = signal<Liquidacion[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly totalPaginas = signal(0);
  readonly pagina = signal(1);
  readonly proveedor = signal("");
  readonly estado = signal("");
  readonly desde = signal("");
  readonly hasta = signal("");
  readonly seleccionadoId = signal<number | null>(null);
  readonly proveedores = signal<ProveedorListadoItem[]>([]);

  /** Escribir (generar/pagar) exige nivel total del permiso. */
  readonly puedeEscribir = computed(() => this.sesion.usuario()?.permisos?.["liquidar_proveedor"] === "total");

  readonly detalle = signal<LiquidacionDetalle | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly errorDetalle = signal<string | null>(null);
  readonly totalesDetalle = computed(() => {
    const e = this.detalle()?.envios ?? [];
    return {
      bruto: e.reduce((a, x) => a + x.montoBruto, 0),
      comision: e.reduce((a, x) => a + x.comision, 0),
      neto: e.reduce((a, x) => a + x.montoNeto, 0)
    };
  });

  // pago en dos pasos
  readonly pagando = signal(false);
  readonly fechaPago = signal(hoyYmd());
  readonly confirmandoPago = signal(false);
  readonly errorFecha = signal<string | null>(null);
  readonly enCurso = signal(false);
  readonly errorAccion = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  // generar
  readonly generando = signal(false);
  readonly genDesde = signal(semanaAnteriorYmd().desde);
  readonly genHasta = signal(semanaAnteriorYmd().hasta);
  readonly errorRango = signal<string | null>(null);
  readonly ejecutandoGen = signal(false);
  readonly errorGen = signal<string | null>(null);
  readonly resultado = signal<ResultadoGeneracion | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.proveedor.set(p.get("proveedor") ?? "");
      this.estado.set(p.get("estado") ?? "");
      this.desde.set(p.get("desde") ?? "");
      this.hasta.set(p.get("hasta") ?? "");
      this.pagina.set(Math.max(1, Number(p.get("pagina")) || 1));
      const sel = Number(p.get("liquidacion")) || null;
      const cambio = sel !== this.seleccionadoId();
      this.seleccionadoId.set(sel);
      this.cargar();
      if (cambio) this.cargarDetalle();
    });
    // Opciones del filtro; si el usuario no puede ver proveedores el select queda vacio.
    this.proveedoresSvc.listar({ tamano: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.proveedores.set(r.items),
      error: () => this.proveedores.set([])
    });
  }

  onProveedor(v: string): void { this.navegar({ proveedor: v || null, pagina: null }); }
  onEstado(v: string): void { this.navegar({ estado: v || null, pagina: null }); }
  onDesde(v: string): void { this.navegar({ desde: v || null, pagina: null }); }
  onHasta(v: string): void { this.navegar({ hasta: v || null, pagina: null }); }
  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas() || n === this.pagina()) return;
    this.navegar({ pagina: n === 1 ? null : n });
  }
  seleccionar(id: number): void { this.navegar({ liquidacion: id }); }
  cerrarDetalle(): void { this.navegar({ liquidacion: null }); }
  reintentar(): void { this.cargar(); }
  reintentarDetalle(): void { this.cargarDetalle(); }

  // --- pago ---
  iniciarPago(): void {
    this.pagando.set(true);
    this.confirmandoPago.set(false);
    this.fechaPago.set(hoyYmd());
    this.errorFecha.set(null);
    this.errorAccion.set(null);
  }
  cancelarPago(): void {
    this.pagando.set(false);
    this.confirmandoPago.set(false);
    this.errorFecha.set(null);
  }
  /** Paso 1: valida la fecha y pide confirmacion. */
  revisarPago(): void {
    const e = validarFechaPago(this.fechaPago());
    this.errorFecha.set(e);
    if (!e) this.confirmandoPago.set(true);
  }
  volverAEditar(): void { this.confirmandoPago.set(false); }
  /** Paso 2: ejecuta. */
  confirmarPago(): void {
    const d = this.detalle();
    if (!d) return;
    this.enCurso.set(true);
    this.errorAccion.set(null);
    this.svc.pagar(d.id, this.fechaPago()).subscribe({
      next: () => {
        this.enCurso.set(false);
        this.cancelarPago();
        this.aviso.set("Liquidación marcada como pagada.");
        this.cargarDetalle();
        this.cargar();
      },
      error: (e) => {
        this.enCurso.set(false);
        this.confirmandoPago.set(false);
        this.errorAccion.set(mensajeErrorLiquidaciones(e));
        if (e?.error?.error?.code === "LIQUIDACION_YA_PAGADA") {
          this.cancelarPago();
          this.cargarDetalle();
          this.cargar();
        }
      }
    });
  }

  // --- generar ---
  abrirGenerar(): void {
    this.generando.set(true);
    this.resultado.set(null);
    this.errorGen.set(null);
    this.errorRango.set(null);
  }
  cerrarGenerar(): void { this.generando.set(false); }
  ejecutarGenerar(): void {
    const e = validarRango(this.genDesde(), this.genHasta());
    this.errorRango.set(e);
    if (e) return;
    this.ejecutandoGen.set(true);
    this.errorGen.set(null);
    this.resultado.set(null);
    this.svc.generar(this.genDesde(), this.genHasta()).subscribe({
      next: (r) => {
        this.ejecutandoGen.set(false);
        this.resultado.set(r);
        this.cargar();
      },
      error: (err) => {
        this.ejecutandoGen.set(false);
        this.errorGen.set(mensajeErrorLiquidaciones(err));
      }
    });
  }

  private navegar(params: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: "merge" });
  }

  private cargar(): void {
    const id = ++this.solicitud;
    this.cargando.set(true);
    this.error.set(null);
    this.svc
      .listar({
        proveedorId: this.proveedor() ? Number(this.proveedor()) : "",
        estado: this.estado() as EstadoLiquidacion | "",
        desde: this.desde(),
        hasta: this.hasta(),
        pagina: this.pagina(),
        tamano: TAMANO
      })
      .subscribe({
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
          this.error.set(mensajeErrorLiquidaciones(e));
          this.cargando.set(false);
        }
      });
  }

  private cargarDetalle(): void {
    const sel = this.seleccionadoId();
    const id = ++this.solicitudDetalle;
    this.cancelarPago();
    this.errorAccion.set(null);
    if (sel === null) {
      this.detalle.set(null);
      this.errorDetalle.set(null);
      return;
    }
    this.cargandoDetalle.set(true);
    this.errorDetalle.set(null);
    this.svc.obtener(sel).subscribe({
      next: (d) => {
        if (id !== this.solicitudDetalle) return;
        this.detalle.set(d);
        this.cargandoDetalle.set(false);
      },
      error: (e) => {
        if (id !== this.solicitudDetalle) return;
        this.detalle.set(null);
        this.errorDetalle.set(mensajeErrorLiquidaciones(e));
        this.cargandoDetalle.set(false);
      }
    });
  }
}
