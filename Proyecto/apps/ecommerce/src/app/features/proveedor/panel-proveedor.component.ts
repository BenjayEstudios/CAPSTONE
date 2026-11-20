import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { SessionState } from "../../core/state/session.state";

/** Pestañas del panel. Cada historia del proveedor (KAN-102 a 111) agrega la suya. */
export const PESTANAS_PROVEEDOR: Array<{ ruta: string; etiqueta: string; exacta?: boolean }> = [{ ruta: "/proveedor", etiqueta: "Panel", exacta: true }];

// Marco del panel del proveedor (KAN-101): franja con la empresa y las
// pestañas, como en el mockup del proveedor. Las pantallas van en el outlet.
@Component({
  selector: "app-panel-proveedor",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="contenedor marco">
      <p class="franja">Panel de proveedor · <strong>{{ session.usuario()?.organizacion?.nombre }}</strong> · Cuenta verificada</p>
      <div class="titulo">
        <div>
          <h1>Cotizapp <span>para distribuidores</span></h1>
          <p>Publica tus precios, despacha y cobra en un solo lugar.</p>
        </div>
      </div>
      <nav class="pestanas" aria-label="Panel de proveedor">
        @for (p of pestanas; track p.ruta) {
          <a [routerLink]="p.ruta" routerLinkActive="activa" [routerLinkActiveOptions]="{ exact: !!p.exacta }" ariaCurrentWhenActive="page">{{ p.etiqueta }}</a>
        }
      </nav>
      <router-outlet />
    </div>
  `,
  styles: `
    .marco { padding-block: 18px 64px; }
    .franja { font-size: 12px; letter-spacing: .04em; color: var(--color-text-soft); margin: 0 0 14px; }
    .franja strong { color: var(--color-text); }
    .titulo h1 { font-size: clamp(26px, 3.4vw, 36px); margin: 0; }
    .titulo h1 span { font-weight: 400; color: var(--color-text-soft); font-size: .6em; margin-left: 6px; }
    .titulo p { margin: 4px 0 0; color: var(--color-text-soft); font-size: 14px; }
    .pestanas { display: flex; gap: 22px; border-bottom: 1px solid var(--color-divider); margin: 18px 0 26px; overflow-x: auto; }
    .pestanas a { padding: 10px 0; color: var(--color-text-soft); text-decoration: none; font-size: 14.5px; border-bottom: 3px solid transparent; white-space: nowrap; }
    .pestanas a.activa { color: var(--color-accent-800); border-bottom-color: var(--color-accent); font-weight: 600; }
  `
})
export class PanelProveedorComponent {
  readonly session = inject(SessionState);
  readonly pestanas = PESTANAS_PROVEEDOR;
}
