import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RELOJ } from "../../core/reloj";
import { DocumentoExigido, PanelProveedorService, TipoDocumento } from "../../core/proveedor/panel-proveedor.service";

const FECHA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const TAMANO_MAXIMO = 5 * 1024 * 1024;

/** Etiqueta y tono de la vigencia: "Al día", "Vence en 18 días", "Vencido", "Falta". */
export function textoVigencia(d: Pick<DocumentoExigido, "estado" | "actual">): { texto: string; tono: "ok" | "aviso" | "alerta" } {
  switch (d.estado) {
    case "falta":
      return { texto: "Falta", tono: "alerta" };
    case "vencido":
      return { texto: "Vencido", tono: "alerta" };
    case "por_vencer": {
      const n = d.actual?.diasParaVencer ?? 0;
      return { texto: n === 0 ? "Vence hoy" : `Vence en ${n} ${n === 1 ? "día" : "días"}`, tono: "aviso" };
    }
    default:
      return { texto: "Al día", tono: "ok" };
  }
}

/** Revision del admin en palabras. */
export function textoRevision(r: DocumentoExigido["actual"]): string {
  if (!r) return "";
  if (r.revisionEstado === "pendiente") return "Pendiente de revisión del equipo de Cotizapp";
  if (r.revisionEstado === "aprobado") return "Aprobado";
  return `Rechazado${r.motivoRechazo ? `: ${r.motivoRechazo}` : ""}. Sube uno nuevo.`;
}

const ERRORES: Record<string, string> = {
  VENCIMIENTO_REQUERIDO: "Indica la fecha de vencimiento del documento.",
  DOCUMENTO_VENCIDO: "La fecha de vencimiento ya pasó: sube un documento vigente.",
  FORMATO_NO_SOPORTADO: "Solo se aceptan archivos PDF, JPG o PNG.",
  ARCHIVO_MUY_GRANDE: "El archivo supera los 5 MB.",
  ARCHIVO_VACIO: "El archivo está vacío."
};

interface Subida { archivo: File | null; venceEn: string }

// /proveedor/documentos (KAN-110): carpeta tributaria, resolucion sanitaria y
// certificado de vigencia. Cada uno muestra si esta al dia, por vencer (45
// dias o menos, como las alertas del panel) o vencido con su fecha, y como va
// la revision del admin. Subir uno nuevo lo deja pendiente de revision.
@Component({
  selector: "app-documentos-proveedor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./documentos.component.html",
  styleUrl: "./documentos.component.css"
})
export class DocumentosProveedorComponent {
  private readonly panel = inject(PanelProveedorService);
  private readonly hoy = inject(RELOJ);

  readonly documentos = signal<DocumentoExigido[]>([]);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly subiendo = signal<TipoDocumento | null>(null);
  readonly abierto = signal<TipoDocumento | null>(null);
  readonly error = signal<{ tipo: TipoDocumento; texto: string } | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly subidas: Record<TipoDocumento, Subida> = {
    carpeta_tributaria: { archivo: null, venceEn: "" },
    resolucion_sanitaria: { archivo: null, venceEn: "" },
    vigencia: { archivo: null, venceEn: "" }
  };

  readonly vigencia = textoVigencia;
  readonly revision = textoRevision;
  readonly fecha = (iso: string) => FECHA.format(new Date(`${iso}T00:00:00Z`));
  readonly minimo = () => this.hoy().toISOString().slice(0, 10);

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      this.documentos.set((await this.panel.documentos()).items);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  abrir(tipo: TipoDocumento): void {
    this.abierto.set(this.abierto() === tipo ? null : tipo);
    this.error.set(null);
  }

  elegirArchivo(tipo: TipoDocumento, ev: Event): void {
    this.subidas[tipo].archivo = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.error.set(null);
  }

  /** Lo que falta para poder subir (null = listo). */
  falta(d: DocumentoExigido): string | null {
    const s = this.subidas[d.tipo];
    if (!s.archivo) return "Elige el archivo.";
    if (s.archivo.size > TAMANO_MAXIMO) return ERRORES["ARCHIVO_MUY_GRANDE"]!;
    if (d.requiereVencimiento && !s.venceEn) return "Indica la fecha de vencimiento.";
    if (s.venceEn && s.venceEn < this.minimo()) return ERRORES["DOCUMENTO_VENCIDO"]!;
    return null;
  }

  async subir(d: DocumentoExigido): Promise<void> {
    const problema = this.falta(d);
    if (problema) return this.error.set({ tipo: d.tipo, texto: problema });
    if (this.subiendo()) return;
    const s = this.subidas[d.tipo];
    this.subiendo.set(d.tipo);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await this.panel.subirDocumento(d.tipo, s.archivo!, s.venceEn || null);
      this.subidas[d.tipo] = { archivo: null, venceEn: "" };
      this.abierto.set(null);
      this.aviso.set(`Recibimos tu ${d.nombre.toLowerCase()}. Queda pendiente de revisión del equipo de Cotizapp.`);
      this.documentos.set((await this.panel.documentos()).items);
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
      const texto = (code && ERRORES[code]) ?? (err instanceof HttpErrorResponse && err.status === 413 ? ERRORES["ARCHIVO_MUY_GRANDE"]! : "No pudimos subir el documento. Inténtalo de nuevo.");
      this.error.set({ tipo: d.tipo, texto });
    } finally {
      this.subiendo.set(null);
    }
  }
}
