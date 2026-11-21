import { NgTemplateOutlet } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import {
  CoberturaProveedor,
  PanelProveedorService,
  PuntoRetiroProveedor,
  RegionCobertura,
  ZonaDespacho
} from "../../core/proveedor/panel-proveedor.service";
import { formatearClp, plazo } from "../../shared/formato";

/** "Ñuñoa" o "Toda la región". */
export function nombreZona(z: Pick<ZonaDespacho, "comuna" | "comunaId">): string {
  return z.comunaId === null ? "Toda la región" : (z.comuna ?? "—");
}

/** "Pedro de Valdivia 100, Of. 2, Ñuñoa" */
export function textoDireccion(d: { calle: string; numero: string | null; complemento: string | null; comuna: string }): string {
  return [[d.calle, d.numero].filter(Boolean).join(" "), d.complemento, d.comuna].filter(Boolean).join(", ");
}

const ERRORES: Record<string, string> = {
  ZONA_DUPLICADA: "Ya despachas a esa zona: edita su costo o plazo.",
  ULTIMO_PUNTO_RETIRO: "Es tu único punto de retiro activo. Agrega otro o, en tu perfil, pasa a solo despacho.",
  PUNTO_USADO: "Ya hubo retiros en este punto: desactívalo en vez de borrarlo.",
  ZONA_NO_ENCONTRADA: "Esa zona ya no existe. Recargamos la lista.",
  PUNTO_NO_ENCONTRADO: "Ese punto ya no existe. Recargamos la lista."
};

interface FormPunto { nombre: string; horario: string; calle: string; numero: string; complemento: string; comunaId: number | null }
const puntoVacio = (): FormPunto => ({ nombre: "", horario: "", calle: "", numero: "", complemento: "", comunaId: null });
const nulo = (v: string) => (v.trim() === "" ? null : v.trim());

// /proveedor/cobertura (KAN-109): donde despacha el proveedor, a que costo y
// en que plazo (por comuna o por toda la region), y sus puntos de retiro
// (direccion, horario, activo). El checkout usa estas zonas para ofrecer
// despacho solo a una comuna cubierta. Si despacha o retira se elige en el
// perfil de empresa.
@Component({
  selector: "app-cobertura-proveedor",
  standalone: true,
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: "./cobertura.component.html",
  styleUrl: "./cobertura.component.css"
})
export class CoberturaProveedorComponent {
  private readonly panel = inject(PanelProveedorService);

  readonly cobertura = signal<CoberturaProveedor | null>(null);
  readonly puntos = signal<PuntoRetiroProveedor[]>([]);
  readonly regiones = signal<RegionCobertura[]>([]);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly clp = formatearClp;
  readonly plazo = plazo;
  readonly nombreZona = nombreZona;
  readonly textoDireccion = textoDireccion;

  // Nueva zona
  nuevaRegion = "";
  nuevaComuna: number | null = null;
  nuevoCosto: number | null = null;
  nuevoPlazo: number | null = null;
  // Edicion de zona
  readonly editandoZona = signal<number | null>(null);
  costoEdit: number | null = null;
  plazoEdit: number | null = null;
  // Puntos
  readonly editandoPunto = signal<number | "nuevo" | null>(null);
  formPunto: FormPunto = puntoVacio();

  /** Zonas agrupadas por region, en el orden de las regiones (norte a sur). */
  readonly porRegion = computed(() => {
    const zonas = this.cobertura()?.zonas ?? [];
    const orden = this.regiones().map((r) => r.codigo);
    const grupos = new Map<string, { region: string; zonas: ZonaDespacho[] }>();
    for (const z of zonas) {
      const g = grupos.get(z.regionCodigo) ?? { region: z.region, zonas: [] };
      g.zonas.push(z);
      grupos.set(z.regionCodigo, g);
    }
    return [...grupos.entries()].sort(([a], [b]) => orden.indexOf(a) - orden.indexOf(b)).map(([, g]) => g);
  });

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      const [c, p, r] = await Promise.all([this.panel.cobertura(), this.panel.puntosRetiro(), this.panel.regionesCobertura()]);
      this.cobertura.set(c);
      this.puntos.set(p.items);
      this.regiones.set(r);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  private async recargar(): Promise<void> {
    const [c, p] = await Promise.all([this.panel.cobertura(), this.panel.puntosRetiro()]);
    this.cobertura.set(c);
    this.puntos.set(p.items);
  }

  comunasDe(codigo: string): Array<{ id: number; nombre: string }> {
    return this.regiones().find((r) => r.codigo === codigo)?.comunas ?? [];
  }

  puedeAgregarZona(): boolean {
    return !!this.nuevaRegion && this.nuevoCosto !== null && this.nuevoCosto >= 0 && !this.ocupado();
  }

  private async ejecutar(accion: () => Promise<unknown>, ok: string): Promise<boolean> {
    this.ocupado.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await accion();
      await this.recargar();
      this.aviso.set(ok);
      return true;
    } catch (err) {
      const e = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error : undefined;
      this.error.set((e?.code && ERRORES[e.code]) ?? (err instanceof HttpErrorResponse && err.status === 400 ? "Revisa los datos ingresados." : "No pudimos guardar. Inténtalo de nuevo."));
      if (e?.code?.endsWith("NO_ENCONTRADA") || e?.code?.endsWith("NO_ENCONTRADO")) await this.recargar().catch(() => undefined);
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }

  async agregarZona(): Promise<void> {
    if (!this.puedeAgregarZona()) return;
    const region = this.regiones().find((r) => r.codigo === this.nuevaRegion);
    const comuna = this.comunasDe(this.nuevaRegion).find((c) => c.id === this.nuevaComuna);
    const ok = await this.ejecutar(
      () => this.panel.crearZona({ comunaId: this.nuevaComuna, regionCodigo: this.nuevaRegion, costoDespacho: Number(this.nuevoCosto), plazoHoras: this.nuevoPlazo ? Number(this.nuevoPlazo) : null }),
      `Agregaste ${comuna ? comuna.nombre : `toda la región ${region?.nombre ?? ""}`} a tu cobertura.`
    );
    if (ok) {
      this.nuevaComuna = null;
      this.nuevoCosto = null;
      this.nuevoPlazo = null;
    }
  }

  editarZona(z: ZonaDespacho): void {
    this.editandoZona.set(z.id);
    this.costoEdit = z.costoDespacho;
    this.plazoEdit = z.plazoHoras;
  }

  async guardarZona(z: ZonaDespacho): Promise<void> {
    if (this.costoEdit === null || this.costoEdit < 0) return;
    const ok = await this.ejecutar(
      () => this.panel.actualizarZona(z.id, { costoDespacho: Number(this.costoEdit), plazoHoras: this.plazoEdit ? Number(this.plazoEdit) : null }),
      `Guardamos ${nombreZona(z)} (${z.region}).`
    );
    if (ok) this.editandoZona.set(null);
  }

  async borrarZona(z: ZonaDespacho): Promise<void> {
    await this.ejecutar(() => this.panel.eliminarZona(z.id), `Quitaste ${z.comunaId === null ? `toda la región ${z.region}` : z.comuna} de tu cobertura.`);
  }

  nuevoPunto(): void {
    this.formPunto = puntoVacio();
    this.editandoPunto.set("nuevo");
  }

  editarPunto(p: PuntoRetiroProveedor): void {
    this.formPunto = {
      nombre: p.nombre,
      horario: p.horario ?? "",
      calle: p.direccion.calle,
      numero: p.direccion.numero ?? "",
      complemento: p.direccion.complemento ?? "",
      comunaId: p.direccion.comunaId
    };
    this.editandoPunto.set(p.id);
  }

  puntoCompleto(): boolean {
    const f = this.formPunto;
    return !!f.nombre.trim() && !!f.calle.trim() && f.comunaId !== null;
  }

  async guardarPunto(): Promise<void> {
    const e = this.editandoPunto();
    if (e === null || !this.puntoCompleto() || this.ocupado()) return;
    const f = this.formPunto;
    const direccion = { calle: f.calle.trim(), numero: nulo(f.numero), complemento: nulo(f.complemento), comunaId: f.comunaId! };
    let accion: () => Promise<unknown>;
    if (e === "nuevo") {
      accion = () => this.panel.crearPuntoRetiro({ nombre: f.nombre.trim(), horario: nulo(f.horario), direccion });
    } else {
      const p = this.puntos().find((x) => x.id === e)!;
      const cambios: { nombre?: string; horario?: string | null; direccion?: typeof direccion } = {};
      if (f.nombre.trim() !== p.nombre) cambios.nombre = f.nombre.trim();
      if (nulo(f.horario) !== p.horario) cambios.horario = nulo(f.horario);
      const d = p.direccion;
      if (direccion.calle !== d.calle || direccion.numero !== d.numero || direccion.complemento !== d.complemento || direccion.comunaId !== d.comunaId) cambios.direccion = direccion;
      if (!Object.keys(cambios).length) return this.editandoPunto.set(null);
      accion = () => this.panel.actualizarPuntoRetiro(e, cambios);
    }
    if (await this.ejecutar(accion, e === "nuevo" ? `Agregaste ${f.nombre.trim()}.` : `Guardamos ${f.nombre.trim()}.`)) this.editandoPunto.set(null);
  }

  async cambiarActivo(p: PuntoRetiroProveedor): Promise<void> {
    await this.ejecutar(
      () => this.panel.actualizarPuntoRetiro(p.id, { activo: !p.activo }),
      p.activo ? `${p.nombre} ya no se ofrece para retiro.` : `${p.nombre} vuelve a ofrecerse para retiro.`
    );
  }

  async borrarPunto(p: PuntoRetiroProveedor): Promise<void> {
    await this.ejecutar(() => this.panel.eliminarPuntoRetiro(p.id), `Borraste ${p.nombre}.`);
  }
}
