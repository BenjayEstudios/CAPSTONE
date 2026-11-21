import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import { ProductoCatalogo } from "../../core/models/catalogo.models";
import { formatearClp, formatearEntero } from "../../shared/formato";

/** 1248 -> "1.248"; 34000 -> "34 mil" (como los contadores del mockup). */
export function contador(n: number): string {
  return n >= 10_000 ? `${formatearEntero(Math.round(n / 1000))} mil` : formatearEntero(n);
}

// Inicio del ecommerce (KAN-89), siguiendo la portada del mockup del cliente:
// propuesta y contadores a la izquierda; categorias con su conteo y "Mayor
// diferencia de precio hoy" a la derecha. Todo con datos reales del API.
@Component({
  selector: "app-inicio",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./inicio.component.html",
  styleUrl: "./inicio.component.css"
})
export class InicioComponent implements OnInit {
  private readonly catalogo = inject(CatalogoService);
  private readonly router = inject(Router);

  readonly resumen = this.catalogo.resumen;
  readonly categorias = computed(() =>
    (this.resumen()?.categorias ?? []).filter((c) => c.productos > 0).map((c) => ({ ...c, hijos: c.hijos.filter((h) => h.productos > 0) }))
  );
  readonly diferencias = signal<ProductoCatalogo[] | null>(null);
  readonly errorDiferencias = signal(false);
  readonly clp = formatearClp;
  readonly contador = contador;
  /** Busqueda de ejemplo: un producto que en el seed tiene ofertas. */
  readonly ejemplo = "arroz";

  ngOnInit(): void {
    void this.catalogo.cargarResumen();
    void this.cargarDiferencias();
  }

  async cargarDiferencias(): Promise<void> {
    this.errorDiferencias.set(false);
    try {
      this.diferencias.set(await this.catalogo.mayorDiferencia(5));
    } catch {
      this.errorDiferencias.set(true);
    }
  }

  buscarEjemplo(): void {
    void this.router.navigate(["/buscar"], { queryParams: { q: this.ejemplo } });
  }
}
