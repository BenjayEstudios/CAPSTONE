import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, input, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CheckoutService } from "../../core/checkout/checkout.service";
import { CalificacionEnvio, EnvioOrden } from "../../core/models/checkout.models";

const ETIQUETAS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

// Calificar al distribuidor de un envio entregado (KAN-99): puntaje 1 a 5 y
// comentario opcional, una sola vez. Si ya se califico, muestra la
// calificacion. El promedio se ve en la ficha de producto (comparador).
@Component({
  selector: "app-calificar-envio",
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (calificacion(); as c) {
      <div class="calificada">
        <p class="titulo">Tu calificación</p>
        <p class="estrellas" [attr.aria-label]="c.puntaje + ' de 5 estrellas'">
          @for (n of cinco; track n) { <span [class.llena]="n <= c.puntaje" aria-hidden="true">★</span> }
          <small>{{ etiqueta(c.puntaje) }}</small>
        </p>
        @if (c.comentario) { <p class="comentario">“{{ c.comentario }}”</p> }
        @if (recien()) { <p class="gracias" role="status">¡Gracias! Se suma al promedio de {{ envio().proveedorNombre }} en el comparador.</p> }
      </div>
    } @else {
      <form class="calificar" (ngSubmit)="enviar()" novalidate>
        <fieldset>
          <legend>¿Cómo te fue con {{ envio().proveedorNombre }}?</legend>
          <div class="opciones" role="radiogroup" aria-label="Puntaje">
            @for (n of cinco; track n) {
              <label [class.llena]="n <= (hover() ?? puntaje() ?? 0)" (mouseenter)="hover.set(n)" (mouseleave)="hover.set(null)">
                <input type="radio" [name]="'puntaje-' + envio().id" [value]="n" [checked]="puntaje() === n" (change)="puntaje.set(n)" />
                <span aria-hidden="true">★</span>
                <span class="visualmente-oculto">{{ n }} {{ n === 1 ? "estrella" : "estrellas" }}: {{ etiqueta(n) }}</span>
              </label>
            }
            <small class="etiqueta-puntaje">{{ etiqueta(hover() ?? puntaje() ?? 0) }}</small>
          </div>
        </fieldset>
        <label class="field">
          <span>Comentario (opcional)</span>
          <textarea class="input" [name]="'comentario-' + envio().id" rows="2" maxlength="500" [(ngModel)]="comentario"
            placeholder="¿Llegó a tiempo y en buen estado?"></textarea>
        </label>
        @if (error(); as e) { <p class="mensaje error" role="alert">{{ e }}</p> }
        <button type="submit" class="btn btn-primary" [disabled]="!puntaje() || enviando()">{{ enviando() ? "Enviando…" : "Enviar calificación" }}</button>
      </form>
    }
  `,
  styles: `
    :host { display: block; border-top: 1px solid var(--color-divider); margin-top: 14px; padding-top: 12px; }
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    legend, .titulo { font-weight: 600; font-size: 14px; margin: 0 0 4px; padding: 0; }
    .opciones { display: flex; align-items: center; gap: 2px; }
    .opciones label { position: relative; cursor: pointer; font-size: 26px; line-height: 1; color: var(--color-divider); padding: 2px; }
    .opciones label.llena, .estrellas .llena { color: var(--color-yellow); }
    .opciones input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
    .opciones label:has(input:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 1px; }
    .etiqueta-puntaje { margin-left: 8px; font-size: 13px; color: var(--color-text-soft); }
    .field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-text-soft); margin: 10px 0; }
    textarea { resize: vertical; font: inherit; color: var(--color-text); }
    .mensaje { margin-bottom: 10px; }
    .estrellas { margin: 0; font-size: 20px; color: var(--color-divider); }
    .estrellas small { font-size: 13px; color: var(--color-text-soft); margin-left: 6px; }
    .comentario { margin: 4px 0 0; font-size: 14px; font-style: italic; }
    .gracias { margin: 6px 0 0; font-size: 13px; color: #1d5e38; }
    .visualmente-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `
})
export class CalificarEnvioComponent {
  private readonly checkout = inject(CheckoutService);

  readonly envio = input.required<EnvioOrden>();
  /** La recien enviada o, si no, la que trae el detalle. */
  private readonly enviada = signal<CalificacionEnvio | null>(null);
  readonly calificacion = computed(() => this.enviada() ?? this.envio().calificacion ?? null);
  readonly recien = signal(false);

  readonly cinco = [1, 2, 3, 4, 5];
  readonly puntaje = signal<number | null>(null);
  readonly hover = signal<number | null>(null);
  comentario = "";
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  etiqueta(n: number): string {
    return ETIQUETAS[n] ?? "";
  }

  async enviar(): Promise<void> {
    const puntaje = this.puntaje();
    if (!puntaje || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    try {
      const c = await this.checkout.calificar(this.envio().id, puntaje, this.comentario.trim() || null);
      this.enviada.set({ puntaje: c.puntaje, comentario: c.comentario, creadaEn: c.creadaEn });
      this.recien.set(true);
    } catch (err) {
      const code = err instanceof HttpErrorResponse ? (err.error as { error?: { code?: string } } | null)?.error?.code : undefined;
      this.error.set(
        code === "YA_CALIFICADO"
          ? "Este envío ya fue calificado."
          : code === "ENVIO_NO_CALIFICABLE"
            ? "Solo puedes calificar un envío entregado."
            : "No pudimos guardar tu calificación. Inténtalo de nuevo."
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
