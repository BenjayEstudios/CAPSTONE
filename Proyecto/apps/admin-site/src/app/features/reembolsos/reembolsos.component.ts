import { DatePipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { ReembolsoItem, ResumenReembolsos } from "../../core/models/reembolsos.models";
import { formatoClp } from "../ordenes/ordenes.util";
import { ReembolsosService } from "./reembolsos.service";
import { ModoReembolso, mensajeErrorReembolsos, validarReembolso } from "./reembolsos.util";

@Component({
  selector: "app-reembolsos",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./reembolsos.component.html",
  styleUrl: "./reembolsos.component.css"
})
export class ReembolsosComponent {
  private readonly svc = inject(ReembolsosService);
  readonly clp = formatoClp;

  readonly codigo = signal("");
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly resumen = signal<ResumenReembolsos | null>(null);

  readonly modo = signal<ModoReembolso>("total");
  readonly montoTexto = signal("");
  readonly motivo = signal("");
  /** 1 = completar formulario; 2 = confirmar (sin alert/confirm del navegador). */
  readonly paso = signal<1 | 2>(1);
  readonly intentado = signal(false);
  readonly enviando = signal(false);
  readonly errorEnvio = signal<string | null>(null);
  readonly exito = signal<string | null>(null);
  readonly errorPdf = signal<string | null>(null);

  readonly validacion = computed(() => {
    const r = this.resumen();
    return validarReembolso(this.modo(), this.montoTexto(), this.motivo(), r?.saldo ?? 0);
  });
  readonly valido = computed(() => this.validacion().monto !== undefined && !this.validacion().error && !this.validacion().errorMotivo);

  buscar(): void {
    const c = this.codigo().trim();
    if (!c || this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);
    this.svc.buscar(c).subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.resumen.set(r);
        this.reiniciarFormulario();
      },
      error: (e) => {
        this.cargando.set(false);
        this.resumen.set(null);
        this.error.set(mensajeErrorReembolsos(e));
      }
    });
  }

  elegirModo(m: ModoReembolso): void {
    this.modo.set(m);
    this.paso.set(1);
  }

  revisar(): void {
    this.intentado.set(true);
    this.errorEnvio.set(null);
    if (this.valido()) this.paso.set(2);
  }

  volver(): void {
    this.paso.set(1);
  }

  confirmar(): void {
    const r = this.resumen();
    const monto = this.validacion().monto;
    if (!r || monto === undefined || !this.valido() || this.enviando()) return;
    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.svc.crear(r.orden.id, { ...(this.modo() === "parcial" ? { monto } : {}), motivo: this.motivo().trim() }).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.resumen.set(res);
        this.exito.set(`Reembolso registrado: nota de crédito N° ${res.notaCredito.folio} por ${formatoClp(res.notaCredito.total)}.`);
        this.reiniciarFormulario();
      },
      error: (e) => {
        this.enviando.set(false);
        this.paso.set(1);
        this.errorEnvio.set(mensajeErrorReembolsos(e));
      }
    });
  }

  verPdf(item: ReembolsoItem): void {
    this.errorPdf.set(null);
    this.svc.pdf(item.pdfUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => this.errorPdf.set(mensajeErrorReembolsos(e))
    });
  }

  private reiniciarFormulario(): void {
    this.modo.set("total");
    this.montoTexto.set("");
    this.motivo.set("");
    this.paso.set(1);
    this.intentado.set(false);
    this.errorEnvio.set(null);
  }
}
