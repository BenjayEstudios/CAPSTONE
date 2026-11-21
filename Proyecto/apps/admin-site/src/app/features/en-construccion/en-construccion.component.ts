import { Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

// Placeholder de los modulos aun no implementados. El titulo viene de
// `data.titulo` de la ruta.
@Component({
  selector: "app-en-construccion",
  standalone: true,
  template: `
    <h2>{{ titulo }}</h2>
    <p class="aviso">En construcción</p>
    <p class="detalle">Este módulo aún no está disponible. Pronto podrás gestionarlo desde aquí.</p>
  `,
  styles: [
    `
      h2 { font-size: 26px; margin: 0 0 6px; }
      .aviso { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: var(--radius-pill); background: var(--color-primary-100); color: var(--color-primary); }
      .detalle { font-size: 14px; max-width: 64ch; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
    `
  ]
})
export class EnConstruccionComponent {
  readonly titulo = inject(ActivatedRoute).snapshot.data["titulo"] ?? "Módulo";
}
