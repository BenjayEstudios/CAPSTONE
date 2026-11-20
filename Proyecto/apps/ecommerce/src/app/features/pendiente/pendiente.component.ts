import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { SessionState } from "../../core/state/session.state";

export interface DatosPendiente {
  titulo: string;
  ticket: string;
  texto: string;
}

// Pantalla provisoria para rutas cuya historia todavia no se implementa
// (inicio KAN-89, catalogo KAN-90, checkout KAN-95). Existen ya para que las
// reglas de acceso de KAN-97 se puedan probar: el catalogo es publico y el
// checkout exige sesion.
@Component({
  selector: "app-pendiente",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="contenedor pendiente">
      <p class="etiqueta">{{ datos.ticket }} · en desarrollo</p>
      <h1>{{ datos.titulo }}</h1>
      <p>{{ datos.texto }}</p>
      @if (busqueda) {
        <p class="mensaje aviso">Buscaste «{{ busqueda }}». Los resultados llegan con KAN-91.</p>
      }
      @if (session.autenticado()) {
        <p class="mensaje ok">Estás con sesión iniciada como {{ session.usuario()?.nombre }} ({{ session.usuario()?.organizacion?.nombre }}).</p>
      }
      <p class="acciones">
        <a routerLink="/catalogo" class="btn btn-secondary">Catálogo (sin cuenta)</a>
        <a routerLink="/checkout" class="btn btn-secondary">Checkout (pide sesión)</a>
      </p>
    </section>
  `,
  styles: `
    .pendiente { padding-block: clamp(32px, 7vw, 80px); max-width: 720px; }
    .pendiente h1 { font-size: clamp(30px, 4vw, 44px); }
    .pendiente p { color: var(--color-text-soft); }
    .acciones { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 24px; }
  `
})
export class PendienteComponent {
  readonly session = inject(SessionState);
  private readonly ruta = inject(ActivatedRoute).snapshot;
  readonly datos = this.ruta.data as DatosPendiente;
  readonly busqueda = this.ruta.queryParamMap.get("q");
}
