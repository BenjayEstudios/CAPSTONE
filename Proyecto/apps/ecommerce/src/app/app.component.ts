import { Component, computed, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "./core/auth/auth.service";
import { CatalogoService } from "./core/catalogo/catalogo.service";
import { CarroState } from "./core/state/carro.state";
import { SessionState } from "./core/state/session.state";
import { fechaLarga, formatearClp, formatearEntero } from "./shared/formato";

// Shell del ecommerce, como la cabecera del mockup del cliente: franja con la
// fecha y los proveedores activos, marca con buscador y carro, y la barra de
// categorias (nivel 1 y 2) con datos reales de /catalogo/resumen.
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent implements OnInit {
  readonly session = inject(SessionState);
  readonly carro = inject(CarroState);
  private readonly catalogo = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly fecha = fechaLarga();
  readonly clp = formatearClp;
  readonly entero = formatearEntero;
  readonly resumen = this.catalogo.resumen;
  /** Solo categorias con productos visibles: un enlace a una categoria vacia no ayuda. */
  readonly categorias = computed(() =>
    (this.resumen()?.categorias ?? []).filter((c) => c.productos > 0).map((c) => ({ ...c, hijos: c.hijos.filter((h) => h.productos > 0) }))
  );
  busqueda = "";

  ngOnInit(): void {
    void this.catalogo.cargarResumen();
  }

  buscar(): void {
    const q = this.busqueda.trim();
    void this.router.navigate(["/catalogo"], { queryParams: q ? { q } : {} });
  }

  salir(): void {
    this.auth.salir();
    void this.router.navigateByUrl("/");
  }
}
