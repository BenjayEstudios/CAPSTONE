import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ImagenProducto, ProductoFicha } from "../../core/models/catalogo.models";
import { CatalogoService, etiquetasCategorias } from "./catalogo.service";
import {
  FORM_VACIO, FormProducto, MAX_IMAGENES, aPayload, faltantesPublicar, mensajeError, mover,
  validarAncho, validarArchivo, validarBorrador
} from "./producto-ficha.util";

// Lee el ancho real de la imagen en el navegador (null si no se puede decodificar).
function leerAncho(archivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

const ordenar = (l: ImagenProducto[]) => [...l].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

@Component({
  selector: "app-producto-ficha",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./producto-ficha.component.html",
  styleUrl: "./producto-ficha.component.css"
})
export class ProductoFichaComponent {
  private readonly svc = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly id = signal<string | null>(this.route.snapshot.paramMap.get("id"));
  readonly form = signal<FormProducto>({ ...FORM_VACIO });
  readonly categorias = signal<{ id: string; etiqueta: string }[]>([]);
  readonly imagenes = signal<ImagenProducto[]>([]);
  readonly estado = signal("borrador");
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly subiendo = signal(false);
  readonly errorGeneral = signal<string | null>(null);
  readonly errorImagenes = signal<string | null>(null);
  readonly erroresCampo = signal<Record<string, string>>({});
  readonly faltantes = signal<string[]>([]);
  readonly aviso = signal<string | null>(null);

  readonly esNuevo = computed(() => this.id() === null);
  readonly maxImagenes = MAX_IMAGENES;
  readonly unidades = ["kg", "L", "unidad"];

  constructor() {
    this.svc.categorias().subscribe({
      next: (c) => this.categorias.set(etiquetasCategorias(c)),
      error: (e) => this.errorGeneral.set(mensajeError(e))
    });
    const id = this.id();
    if (id) {
      this.cargando.set(true);
      this.svc.obtener(id).subscribe({
        next: (p) => { this.aplicar(p); this.cargando.set(false); },
        error: (e) => { this.errorGeneral.set(mensajeError(e)); this.cargando.set(false); }
      });
    }
  }

  private aplicar(p: ProductoFicha) {
    const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    this.form.set({
      nombre: p.nombre, sku: s(p.sku), ean: s(p.ean),
      categoriaId: s(p.categoria?.id ?? p.categoriaId), marca: s(p.marca), formato: s(p.formato),
      contenido: s(p.contenido), unidad: p.unidad, descripcion: s(p.descripcion),
      precioReferencia: s(p.precioReferencia), topeSobreReferenciaPct: s(p.topeSobreReferenciaPct)
    });
    this.imagenes.set(ordenar(p.imagenes ?? []));
    this.estado.set(p.estado);
  }

  set(campo: keyof FormProducto, valor: string) {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  guardarBorrador() { this.guardar(false); }
  publicar() { this.guardar(true); }

  private guardar(publicar: boolean) {
    this.aviso.set(null);
    this.errorGeneral.set(null);
    const errores = validarBorrador(this.form());
    this.erroresCampo.set(errores);
    const faltan = publicar ? faltantesPublicar(this.form(), this.imagenes()) : [];
    this.faltantes.set(faltan);
    if (Object.keys(errores).length || faltan.length) return;

    const body = aPayload(this.form());
    const id = this.id();
    body.estado = publicar ? "publicado" : "borrador";
    this.guardando.set(true);
    const req = id ? this.svc.actualizar(id, body) : this.svc.crear(body);
    req.subscribe({
      next: (p) => {
        this.guardando.set(false);
        if (!id) {
          // Con el id ya se pueden subir imagenes: se redirige a la ficha.
          void this.router.navigate(["/catalogo-maestro", p.id]);
          return;
        }
        this.aplicar(p);
        this.aviso.set(publicar ? "Producto publicado." : "Borrador guardado.");
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorGeneral.set(mensajeError(e));
        const code = e?.error?.error?.code;
        if (code === "SKU_DUPLICADO") this.erroresCampo.update((x) => ({ ...x, sku: "SKU ya existente." }));
        if (code === "EAN_DUPLICADO") this.erroresCampo.update((x) => ({ ...x, ean: "EAN ya existente." }));
        if (code === "CATEGORIA_NO_EXISTE") this.erroresCampo.update((x) => ({ ...x, categoriaId: "Categoria inexistente." }));
      }
    });
  }

  async onArchivos(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = "";
    const id = this.id();
    if (!id) return;
    this.errorImagenes.set(null);
    for (const a of archivos) {
      if (this.imagenes().length >= MAX_IMAGENES) { this.errorImagenes.set(`Maximo ${MAX_IMAGENES} imagenes.`); break; }
      const err = validarArchivo(a);
      if (err) { this.errorImagenes.set(`${a.name}: ${err}`); continue; }
      const ancho = await leerAncho(a);
      const errAncho = ancho !== null ? validarAncho(ancho) : null;
      if (errAncho) { this.errorImagenes.set(`${a.name}: ${errAncho}`); continue; }
      this.subiendo.set(true);
      try {
        const r = await new Promise<{ url: string; ancho: number; alto: number }>((ok, ko) =>
          this.svc.subirImagen(id, a).subscribe({ next: ok, error: ko }));
        const n = this.imagenes().length;
        await this.persistirImagenes([...this.imagenes(), { url: r.url, ancho: r.ancho, alto: r.alto, esPrincipal: n === 0, orden: n }]);
      } catch (e) {
        this.errorImagenes.set(`${a.name}: ${mensajeError(e)}`);
      } finally {
        this.subiendo.set(false);
      }
    }
  }

  private persistirImagenes(lista: ImagenProducto[]) {
    const id = this.id()!;
    const orden = lista.map((x, k) => ({ ...x, orden: k }));
    return new Promise<void>((ok, ko) =>
      this.svc.guardarImagenes(id, orden).subscribe({
        next: (p) => { this.imagenes.set(ordenar(p.imagenes ?? orden)); ok(); },
        error: ko
      }));
  }

  private async cambiar(lista: ImagenProducto[]) {
    this.errorImagenes.set(null);
    try { await this.persistirImagenes(lista); } catch (e) { this.errorImagenes.set(mensajeError(e)); }
  }

  marcarPrincipal(i: number) { void this.cambiar(this.imagenes().map((x, k) => ({ ...x, esPrincipal: k === i }))); }
  mover(i: number, d: number) { void this.cambiar(mover(this.imagenes(), i, d)); }
  quitar(i: number) {
    const resto = this.imagenes().filter((_, k) => k !== i);
    if (resto.length && !resto.some((x) => x.esPrincipal)) resto[0] = { ...resto[0], esPrincipal: true };
    void this.cambiar(resto);
  }
}
