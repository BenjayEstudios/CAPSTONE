import { Component, computed, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import { Categoria } from "./categorias.models";
import { CategoriasService, mensajeDeError } from "./categorias.service";
import { calcularCambiosOrden, ordenarHermanos, SLUG_REGEX, slugify } from "./categorias.util";

@Component({
  selector: "app-categorias",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./categorias.component.html",
  styleUrl: "./categorias.component.css"
})
export class CategoriasComponent {
  private readonly svc = inject(CategoriasService);

  readonly arbol = signal<Categoria[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal<string | null>(null);
  readonly errorForm = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly formAbierto = signal(false);
  readonly editando = signal<Categoria | null>(null);
  private slugManual = false;

  readonly raices = computed(() => ordenarHermanos(this.arbol()));
  // Posibles padres: solo categorias de nivel 1 (y no la propia).
  readonly padresPosibles = computed(() => this.raices().filter((c) => c.id !== this.editando()?.id));

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ["", [Validators.required, Validators.maxLength(120)]],
    slug: ["", [Validators.required, Validators.pattern(SLUG_REGEX)]],
    padreId: [""],
    orden: [null as number | null, [Validators.min(0)]]
  });

  constructor() {
    void this.cargar();
  }

  hijos(c: Categoria): Categoria[] {
    return ordenarHermanos(c.hijos ?? []);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      this.arbol.set(await firstValueFrom(this.svc.listarArbol()));
    } catch (err) {
      this.errorCarga.set(mensajeDeError(err));
    } finally {
      this.cargando.set(false);
    }
  }

  nueva(padreId = ""): void {
    this.editando.set(null);
    this.slugManual = false;
    this.form.reset({ nombre: "", slug: "", padreId, orden: null });
    this.errorForm.set(null);
    this.formAbierto.set(true);
  }

  editar(c: Categoria): void {
    this.editando.set(c);
    this.slugManual = true;
    this.form.reset({ nombre: c.nombre, slug: c.slug, padreId: c.padreId ?? "", orden: c.orden });
    this.errorForm.set(null);
    this.formAbierto.set(true);
  }

  cancelar(): void {
    this.formAbierto.set(false);
    this.editando.set(null);
  }

  onNombre(): void {
    if (!this.slugManual) this.form.controls.slug.setValue(slugify(this.form.controls.nombre.value));
  }

  onSlug(): void {
    this.slugManual = true;
  }

  async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const actual = this.editando();
    this.guardando.set(true);
    this.errorForm.set(null);
    try {
      if (actual) {
        await firstValueFrom(
          this.svc.actualizar(actual.id, {
            nombre: v.nombre.trim(),
            slug: v.slug,
            padreId: v.padreId || null,
            orden: v.orden ?? null
          })
        );
      } else {
        await firstValueFrom(
          this.svc.crear({
            nombre: v.nombre.trim(),
            slug: v.slug,
            ...(v.padreId ? { padreId: v.padreId } : {}),
            ...(v.orden !== null && v.orden !== undefined ? { orden: v.orden } : {})
          })
        );
      }
      this.cancelar();
      await this.cargar();
    } catch (err) {
      this.errorForm.set(mensajeDeError(err));
    } finally {
      this.guardando.set(false);
    }
  }

  async alternarEstado(c: Categoria): Promise<void> {
    await this.accion(() => firstValueFrom(this.svc.actualizar(c.id, { estado: c.estado === "activa" ? "oculta" : "activa" })));
  }

  async mover(c: Categoria, dir: "subir" | "bajar"): Promise<void> {
    const padre = c.padreId ? this.arbol().find((r) => r.id === c.padreId) : null;
    const hermanos = padre ? this.hijos(padre) : this.raices();
    const cambios = calcularCambiosOrden(hermanos, c.id, dir);
    if (!cambios.length) return;
    await this.accion(() => Promise.all(cambios.map((x) => firstValueFrom(this.svc.actualizar(x.id, { orden: x.orden })))));
  }

  private async accion(fn: () => Promise<unknown>): Promise<void> {
    this.errorAccion.set(null);
    try {
      await fn();
    } catch (err) {
      this.errorAccion.set(mensajeDeError(err));
    }
    await this.cargar();
  }
}
