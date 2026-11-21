import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AccionImportacion, ResultadoImportacion } from "../../core/models/catalogo.models";
import { CatalogoService } from "./catalogo.service";

export const ETIQUETA_ACCION: Record<AccionImportacion, string> = {
  crear: "Crear",
  actualizar: "Actualizar",
  sin_cambios: "Sin cambios",
  error: "Error"
};

// Mensaje legible para un error HTTP del API (o de red).
export function mensajeErrorImportacion(e: unknown): string {
  const err = e as { status?: number; error?: { error?: { message?: string } } };
  if (err?.status === 413) return "La planilla supera el tamaño máximo permitido.";
  if (err?.status === 403) return "No tienes permiso para importar productos.";
  return err?.error?.error?.message ?? "No se pudo procesar la planilla. Revisa tu conexión e inténtalo de nuevo.";
}

@Component({
  selector: "app-catalogo-importar",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./catalogo-importar.component.html",
  styleUrl: "./catalogo-importar.component.css"
})
export class CatalogoImportarComponent {
  private readonly svc = inject(CatalogoService);

  readonly etiqueta = ETIQUETA_ACCION;
  readonly archivo = signal<File | null>(null);
  readonly trabajando = signal<"validando" | "importando" | "descargando" | null>(null);
  readonly error = signal<string | null>(null);
  readonly resultado = signal<ResultadoImportacion | null>(null);
  readonly soloErrores = signal(false);

  /** Solo se puede importar tras validar el archivo actual y si hay algo que guardar. */
  readonly puedeImportar = computed(() => {
    const r = this.resultado();
    return !!r && r.simulacion && r.resumen.crear + r.resumen.actualizar > 0 && this.trabajando() === null;
  });

  readonly filasVisibles = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    return this.soloErrores() ? r.filas.filter((f) => f.accion === "error") : r.filas;
  });

  onArchivo(input: HTMLInputElement): void {
    const f = input.files?.[0] ?? null;
    this.resultado.set(null);
    this.error.set(null);
    if (f && !f.name.toLowerCase().endsWith(".xlsx")) {
      this.archivo.set(null);
      input.value = "";
      this.error.set("El archivo debe ser una planilla Excel (.xlsx). Descarga la plantilla para partir de ella.");
      return;
    }
    this.archivo.set(f);
  }

  /** conProductos: baja el catalogo actual (para editarlo en masa) en vez de la plantilla vacia. */
  descargarPlantilla(conProductos = false): void {
    this.error.set(null);
    this.trabajando.set("descargando");
    this.svc.plantillaImportacion(conProductos).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = conProductos ? "catalogo-maestro-actual.xlsx" : "plantilla-catalogo-maestro.xlsx";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        this.trabajando.set(null);
      },
      error: (e) => {
        this.error.set(mensajeErrorImportacion(e));
        this.trabajando.set(null);
      }
    });
  }

  validar(): void {
    this.ejecutar(true);
  }

  importar(): void {
    if (!this.puedeImportar()) return;
    this.ejecutar(false);
  }

  private ejecutar(simular: boolean): void {
    const archivo = this.archivo();
    if (!archivo || this.trabajando() !== null) return;
    this.error.set(null);
    this.trabajando.set(simular ? "validando" : "importando");
    this.svc.importar(archivo, simular).subscribe({
      next: (r) => {
        this.resultado.set(r);
        this.soloErrores.set(false);
        this.trabajando.set(null);
      },
      error: (e) => {
        this.error.set(mensajeErrorImportacion(e));
        this.trabajando.set(null);
      }
    });
  }
}
