import { Component, input } from "@angular/core";

// Panel de marca de las pantallas de cuenta: que gana quien compra en Cotizapp.
@Component({
  selector: "app-panel-cuenta",
  standalone: true,
  styleUrl: "./cuenta.css",
  template: `
    <aside class="panel">
      <p class="etiqueta">Para restaurantes, pastelerías y pymes de alimentos</p>
      <h1>{{ titulo() }}</h1>
      <p class="bajada">Cotizapp reúne a los distribuidores en un solo lugar para que compares antes de comprar.</p>
      <ul class="razones">
        <li><div><strong>Precio por kilo o litro</strong><span>Compara formatos distintos sin sacar cuentas.</span></div></li>
        <li><div><strong>Plazo y calificación de cada distribuidor</strong><span>Lo que dicen otros compradores después de recibir.</span></div></li>
        <li><div><strong>Un carro, varios distribuidores, un pago</strong><span>Armas el pedido completo y pagas una sola vez.</span></div></li>
      </ul>
    </aside>
  `
})
export class PanelCuentaComponent {
  readonly titulo = input("Compra a tus distribuidores comparando precios");
}
