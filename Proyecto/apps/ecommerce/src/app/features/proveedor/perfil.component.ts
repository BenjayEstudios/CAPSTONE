import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CheckoutService } from "../../core/checkout/checkout.service";
import { Comuna } from "../../core/models/checkout.models";
import { CambiosPerfil, PerfilProveedor, PanelProveedorService } from "../../core/proveedor/panel-proveedor.service";
import { formatearRut } from "./clientes.component";

type Modalidad = "ambos" | "despacho" | "retiro";
interface DireccionForm { calle: string; numero: string; complemento: string; comunaId: number | null }

/** Lo que se edita en pantalla (textos vacios en vez de null). */
export interface FormularioPerfil {
  nombreFantasia: string;
  giro: string;
  emailContacto: string;
  telefono: string;
  direccion: DireccionForm;
  bodega: DireccionForm & { nombre: string; horario: string };
  plazoEstandarHoras: number | null;
  plazoFueraRegionHoras: number | null;
  horaCorte: string;
  despachoGratisDesde: number | null;
  modalidad: Modalidad;
  banco: string;
  cuentaBancaria: string;
}

const t = (v: string | null | undefined) => v ?? "";
const nulo = (v: string) => (v.trim() === "" ? null : v.trim());
const dirForm = (d: { calle: string; numero: string | null; complemento: string | null; comunaId: number } | null | undefined): DireccionForm => ({
  calle: t(d?.calle), numero: t(d?.numero), complemento: t(d?.complemento), comunaId: d?.comunaId ?? null
});

export function formularioDesde(p: PerfilProveedor): FormularioPerfil {
  return {
    nombreFantasia: t(p.nombreFantasia),
    giro: t(p.giro),
    emailContacto: t(p.emailContacto),
    telefono: t(p.telefono),
    direccion: dirForm(p.direccion),
    bodega: { ...dirForm(p.bodega?.direccion), nombre: t(p.bodega?.nombre), horario: t(p.bodega?.horario) },
    plazoEstandarHoras: p.plazoEstandarHoras,
    plazoFueraRegionHoras: p.plazoFueraRegionHoras,
    horaCorte: t(p.horaCorte),
    despachoGratisDesde: p.despachoGratisDesde,
    modalidad: p.ofreceDespacho && p.ofreceRetiro ? "ambos" : p.ofreceRetiro ? "retiro" : "despacho",
    banco: t(p.banco),
    cuentaBancaria: t(p.cuentaBancaria)
  };
}

const numero = (v: number | null | string) => (v === null || v === "" ? null : Number(v));

/** Solo lo que cambio frente al perfil guardado; una direccion va entera si cambio alguna parte. */
export function cambiosPerfil(p: PerfilProveedor, f: FormularioPerfil): CambiosPerfil {
  const c: CambiosPerfil = {};
  const o = formularioDesde(p);
  if (f.nombreFantasia.trim() !== o.nombreFantasia) c.nombreFantasia = f.nombreFantasia.trim();
  if (f.emailContacto.trim() !== o.emailContacto) c.emailContacto = f.emailContacto.trim();
  for (const k of ["giro", "telefono", "banco", "cuentaBancaria"] as const) if (f[k].trim() !== o[k]) c[k] = nulo(f[k]);
  if (f.horaCorte !== o.horaCorte) c.horaCorte = f.horaCorte || null;
  const estandar = numero(f.plazoEstandarHoras);
  if (estandar !== null && estandar !== p.plazoEstandarHoras) c.plazoEstandarHoras = estandar;
  if (numero(f.plazoFueraRegionHoras) !== p.plazoFueraRegionHoras) c.plazoFueraRegionHoras = numero(f.plazoFueraRegionHoras);
  if (numero(f.despachoGratisDesde) !== p.despachoGratisDesde) c.despachoGratisDesde = numero(f.despachoGratisDesde);
  const despacho = f.modalidad !== "retiro";
  const retiro = f.modalidad !== "despacho";
  if (despacho !== p.ofreceDespacho) c.ofreceDespacho = despacho;
  if (retiro !== p.ofreceRetiro) c.ofreceRetiro = retiro;
  const cambioDir = (a: DireccionForm, b: DireccionForm) =>
    a.calle.trim() !== b.calle || a.numero.trim() !== b.numero || a.complemento.trim() !== b.complemento || a.comunaId !== b.comunaId;
  const nueva = (d: DireccionForm) => ({ calle: d.calle.trim(), numero: nulo(d.numero), complemento: nulo(d.complemento), comunaId: d.comunaId! });
  if (cambioDir(f.direccion, o.direccion) && f.direccion.calle.trim() && f.direccion.comunaId) c.direccion = nueva(f.direccion);
  if ((cambioDir(f.bodega, o.bodega) || f.bodega.nombre.trim() !== o.bodega.nombre || f.bodega.horario.trim() !== o.bodega.horario) && f.bodega.calle.trim() && f.bodega.comunaId && f.bodega.nombre.trim()) {
    c.bodega = { ...nueva(f.bodega), nombre: f.bodega.nombre.trim(), horario: nulo(f.bodega.horario) };
  }
  return c;
}

/** Lo que falta para poder guardar (vacio = se puede). */
export function problemasPerfil(f: FormularioPerfil, tieneBodega: boolean): string[] {
  const p: string[] = [];
  if (!f.nombreFantasia.trim()) p.push("El nombre de fantasía no puede quedar vacío.");
  if (!/^\S+@\S+\.\S+$/.test(f.emailContacto.trim())) p.push("Revisa el correo comercial.");
  if (!f.plazoEstandarHoras || f.plazoEstandarHoras < 1) p.push("Indica el plazo estándar en horas.");
  if (f.cuentaBancaria.trim() && !/^[0-9][0-9-]{3,39}$/.test(f.cuentaBancaria.trim())) p.push("La cuenta bancaria lleva solo números y guiones.");
  const dirIncompleta = (d: DireccionForm) => (d.calle.trim() !== "") !== (d.comunaId !== null);
  if (dirIncompleta(f.direccion)) p.push("La dirección comercial necesita calle y comuna.");
  if (f.modalidad !== "despacho" && !tieneBodega && !(f.bodega.nombre.trim() && f.bodega.calle.trim() && f.bodega.comunaId)) {
    p.push("Para ofrecer retiro indica el nombre, la dirección y la comuna de tu bodega.");
  }
  return p;
}

const MES = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });

// /proveedor/perfil (KAN-108): los datos de la ficha publica y de los
// documentos tributarios, como en el mockup (boton "Perfil de empresa" del
// marco del panel). Razon social y RUT se muestran pero no se editan. A la
// derecha, el estado de la cuenta: verificada, comision vigente y entregas a
// tiempo. Las zonas de despacho y los demas puntos de retiro van en KAN-109.
@Component({
  selector: "app-perfil-proveedor",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./perfil.component.html",
  styleUrl: "./perfil.component.css"
})
export class PerfilProveedorComponent {
  private readonly panel = inject(PanelProveedorService);
  private readonly checkout = inject(CheckoutService);

  readonly perfil = signal<PerfilProveedor | null>(null);
  readonly comunas = signal<Comuna[]>([]);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly guardando = signal(false);
  readonly intentado = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  f: FormularioPerfil | null = null;

  readonly rut = formatearRut;
  /** Comunas agrupadas por region, en el orden que trae /comunas (norte a sur). */
  readonly regionesComunas = computed(() => {
    const grupos: Array<{ region: string; comunas: Comuna[] }> = [];
    for (const c of this.comunas()) {
      const g = grupos.at(-1);
      if (g?.region === c.regionNombre) g.comunas.push(c);
      else grupos.push({ region: c.regionNombre, comunas: [c] });
    }
    return grupos;
  });
  readonly desde = computed(() => {
    const p = this.perfil();
    return p ? MES.format(new Date(p.creadaEn)) : "";
  });
  readonly cuenta = computed(() => {
    const p = this.perfil();
    if (!p?.banco && !p?.cuentaBancaria) return "Sin cuenta registrada";
    return [p.banco, p.cuentaBancaria ? `cta. …${p.cuentaBancaria.slice(-4)}` : null].filter(Boolean).join(" · ");
  });

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      const [p, comunas] = await Promise.all([this.panel.perfil(), this.checkout.comunas().catch(() => [] as Comuna[])]);
      this.perfil.set(p);
      this.comunas.set(comunas);
      this.f = formularioDesde(p);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  cambios(): CambiosPerfil {
    const p = this.perfil();
    return p && this.f ? cambiosPerfil(p, this.f) : {};
  }

  hayCambios(): boolean {
    return Object.keys(this.cambios()).length > 0;
  }

  problemas(): string[] {
    return this.f ? problemasPerfil(this.f, !!this.perfil()?.bodega) : [];
  }

  descartar(): void {
    const p = this.perfil();
    if (p) this.f = formularioDesde(p);
    this.intentado.set(false);
    this.error.set(null);
    this.aviso.set(null);
  }

  async guardar(): Promise<void> {
    this.intentado.set(true);
    this.aviso.set(null);
    this.error.set(null);
    if (this.problemas().length || !this.hayCambios() || this.guardando()) return;
    this.guardando.set(true);
    try {
      const p = await this.panel.actualizarPerfil(this.cambios());
      this.perfil.set(p);
      this.f = formularioDesde(p);
      this.intentado.set(false);
      this.aviso.set("Guardamos tu perfil. Los cambios ya se ven en tu ficha.");
    } catch (err) {
      const e = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string; message?: string } } | null)?.error : undefined;
      this.error.set(
        e?.code === "SIN_MODALIDAD" || e?.code === "RETIRO_SIN_BODEGA"
          ? (e.message ?? "No pudimos guardar.")
          : err instanceof HttpErrorResponse && err.status === 400
            ? "Revisa los datos: alguno no tiene el formato esperado."
            : "No pudimos guardar tu perfil. Inténtalo de nuevo."
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
