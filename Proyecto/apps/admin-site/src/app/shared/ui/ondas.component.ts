import { ChangeDetectionStrategy, Component, input } from "@angular/core";

interface Onda {
  readonly d: string;
  readonly color: string;
}

const ANCHO = 1200;
const ALTO = 150;

function crearOnda(alturaRelativa: number, fase: number, amplitud: number): string {
  const y0 = ALTO * (1 - alturaRelativa);
  let d = `M0 ${y0.toFixed(1)}`;
  for (let x = 0; x <= ANCHO; x += 8) {
    d += ` L${x} ${(y0 + Math.sin((x / ANCHO) * 2 * Math.PI + fase) * amplitud).toFixed(1)}`;
  }
  return `${d} L${ANCHO} ${ALTO} L0 ${ALTO} Z`;
}

// Ondas superpuestas (menta, teal y azul profundo) para el pie de las
// pantallas oscuras: login y barra lateral. Tema Laguna.
@Component({
  selector: "app-ondas",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.height]="alto()" [attr.viewBox]="'0 0 ' + ancho + ' ' + altoVista" preserveAspectRatio="none" aria-hidden="true">
      @for (o of ondas; track o.color) {
        <path [attr.d]="o.d" [attr.fill]="o.color" />
      }
    </svg>
  `,
  styles: [`:host { display: block; pointer-events: none; line-height: 0; } svg { width: 100%; display: block; }`]
})
export class OndasComponent {
  readonly alto = input(150);
  readonly ancho = ANCHO;
  readonly altoVista = ALTO;
  readonly ondas: readonly Onda[] = [
    { d: crearOnda(0.62, 0.6, 16), color: "#99e6da" },
    { d: crearOnda(0.4, 2.4, 14), color: "#1fa79d" },
    { d: crearOnda(0.18, 4.2, 10), color: "#0b3d5c" }
  ];
}
