import { DatePipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { DocumentoProveedor, ProveedorFicha } from "../../core/models/proveedores.models";
import { ProveedoresService } from "./proveedores.service";
import {
  ETIQUETA_ESTADO, accionesPermitidas, etiquetaDoc, formatearComision, mensajeErrorProveedor,
  validarComision, validarMotivo
} from "./proveedores.util";

export type AccionProveedor = "aprobar" | "rechazar" | "suspender";

@Component({
  selector: "app-proveedor-ficha",
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: "./proveedor-ficha.component.html",
  styleUrl: "./proveedor-ficha.component.css"
})
export class ProveedorFichaComponent {
  private readonly svc = inject(ProveedoresService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get("id") ?? "";

  readonly etiquetaDoc = etiquetaDoc;
  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly formatearComision = formatearComision;
  readonly maxMotivo = 240;

  readonly ficha = signal<ProveedorFicha | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly enCurso = signal(false);

  // Accion del proveedor en curso (panel en la pagina) y su paso de confirmacion.
  readonly accion = signal<AccionProveedor | null>(null);
  readonly confirmando = signal(false);
  readonly comision = signal("");
  readonly motivo = signal("");
  readonly errorForm = signal<string | null>(null);

  // Rechazo de un documento.
  readonly docRechazando = signal<string | null>(null);
  readonly docMotivo = signal("");
  readonly docError = signal<string | null>(null);

  readonly permitidas = computed(() => {
    const f = this.ficha();
    return f ? accionesPermitidas(f.estado) : { aprobar: false, rechazar: false, suspender: false };
  });
  readonly faltantes = computed(() => (this.ficha()?.requisitos.documentosFaltantes ?? []).map(etiquetaDoc));
  readonly puedeAprobar = computed(() => this.ficha()?.requisitos.puedeAprobar === true);

  constructor() {
    this.cargar(true);
  }

  cargar(inicial = false): void {
    if (inicial) this.cargando.set(true);
    this.svc.obtener(this.id).subscribe({
      next: (f) => {
        this.ficha.set(f);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeErrorProveedor(e));
        this.cargando.set(false);
      }
    });
  }

  // --- Documentos ---
  aprobarDocumento(d: DocumentoProveedor): void {
    this.limpiar();
    this.enCurso.set(true);
    this.svc.revisarDocumento(this.id, d.id, "aprobado").subscribe({
      next: () => this.terminar("Documento aprobado."),
      error: (e) => this.fallar(e)
    });
  }

  abrirRechazoDoc(d: DocumentoProveedor): void {
    this.docRechazando.set(d.id);
    this.docMotivo.set("");
    this.docError.set(null);
  }

  cancelarRechazoDoc(): void {
    this.docRechazando.set(null);
  }

  confirmarRechazoDoc(d: DocumentoProveedor): void {
    const err = validarMotivo(this.docMotivo());
    if (err) return void this.docError.set(err);
    this.limpiar();
    this.enCurso.set(true);
    this.svc.revisarDocumento(this.id, d.id, "rechazado", this.docMotivo().trim()).subscribe({
      next: () => {
        this.docRechazando.set(null);
        this.terminar("Documento rechazado.");
      },
      error: (e) => this.fallar(e)
    });
  }

  // --- Proveedor ---
  abrirAccion(a: AccionProveedor): void {
    this.limpiar();
    this.accion.set(a);
    this.confirmando.set(false);
    this.comision.set("");
    this.motivo.set("");
    this.errorForm.set(null);
  }

  cancelarAccion(): void {
    this.accion.set(null);
    this.confirmando.set(false);
  }

  continuar(): void {
    const a = this.accion();
    const err = a === "aprobar" ? validarComision(this.comision()).error : validarMotivo(this.motivo());
    this.errorForm.set(err);
    if (!err) this.confirmando.set(true);
  }

  ejecutar(): void {
    const a = this.accion();
    if (!a) return;
    this.enCurso.set(true);
    const obs =
      a === "aprobar"
        ? this.svc.aprobar(this.id, validarComision(this.comision()).valor)
        : a === "rechazar"
          ? this.svc.rechazar(this.id, this.motivo().trim())
          : this.svc.suspender(this.id, this.motivo().trim());
    obs.subscribe({
      next: () => {
        this.cancelarAccion();
        this.terminar(
          a === "aprobar" ? "Proveedor aprobado." : a === "rechazar" ? "Proveedor rechazado." : "Proveedor suspendido."
        );
      },
      error: (e) => {
        this.confirmando.set(false);
        this.fallar(e);
      }
    });
  }

  private limpiar(): void {
    this.error.set(null);
    this.aviso.set(null);
  }

  private terminar(msg: string): void {
    this.enCurso.set(false);
    this.aviso.set(msg);
    this.cargar();
  }

  private fallar(e: unknown): void {
    this.enCurso.set(false);
    this.error.set(mensajeErrorProveedor(e));
  }
}
