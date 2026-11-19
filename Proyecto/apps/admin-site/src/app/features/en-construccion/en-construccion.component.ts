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
      h2 { font-size: 34px; margin: 0 0 6px; }
      .aviso { display: inline-block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; padding: 3px 10px; background: var(--color-accent-100); color: var(--color-accent-800); }
      .detalle { font-size: 14px; max-width: 64ch; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
    `
  ]
})
export class EnConstruccionComponent {
  readonly titulo = inject(ActivatedRoute).snapshot.data["titulo"] ?? "Módulo";
}
