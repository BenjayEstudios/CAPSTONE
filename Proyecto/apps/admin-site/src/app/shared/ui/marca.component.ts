import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

// Isotipo de Cotizapp (tema Laguna): cuadrado redondeado con un sol crema
// sobre dos olas teal. Dibujado en SVG para no depender de assets.
@Component({
  selector: "app-logo",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="tamano()" [attr.height]="tamano()" viewBox="0 0 100 100" role="img" aria-label="Cotizapp">
      <rect x="4" y="4" width="92" height="92" rx="26" fill="rgba(31, 167, 157, 0.18)" stroke="#1fa79d" stroke-width="6" />
      <circle cx="62" cy="36" r="10" fill="#f3e2c7" />
      <path d="M20 58 Q31 48 42 58 T64 58 T86 58" fill="none" stroke="#99e6da" stroke-width="7" stroke-linecap="round" />
      <path d="M20 76 Q31 66 42 76 T64 76 T86 76" fill="none" stroke="#1fa79d" stroke-width="7" stroke-linecap="round" />
    </svg>
  `,
  styles: [`:host { display: inline-flex; line-height: 0; } svg { display: block; }`]
})
export class LogoComponent {
  readonly tamano = input(40);
}

// Isotipo + nombre ("Coti" + "zapp" resaltado). `claro` = texto para fondos oscuros.
@Component({
  selector: "app-marca",
  standalone: true,
  imports: [LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-logo [tamano]="tamano()" />
    <span class="nombre" [style.font-size.px]="tamano() * 0.6" [class.claro]="claro()"
      >{{ inicio() }}<span class="resalte">{{ final() }}</span></span
    >
  `,
  styles: [
    `
      :host { display: inline-flex; align-items: center; gap: 0.6em; }
      .nombre { font-family: var(--font-heading); font-weight: 800; letter-spacing: -0.5px; line-height: 1; color: var(--tinta); }
      .nombre .resalte { color: var(--color-primary); }
      .nombre.claro { color: #fff; }
      .nombre.claro .resalte { color: var(--color-menta); }
    `
  ]
})
export class MarcaComponent {
  readonly nombre = input.required<string>();
  readonly claro = input(false);
  readonly tamano = input(40);
  /** Parte inicial del nombre ("Coti"); el resto se resalta. */
  readonly inicio = computed(() => this.nombre().slice(0, 4));
  readonly final = computed(() => this.nombre().slice(4));
}
