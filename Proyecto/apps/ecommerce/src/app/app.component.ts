import { Component, inject } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "./core/auth/auth.service";
import { SessionState } from "./core/state/session.state";

// Shell del ecommerce: cabecera con la marca, el catalogo (publico) y el
// estado de la sesion.
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent {
  readonly session = inject(SessionState);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  salir(): void {
    this.auth.salir();
    void this.router.navigateByUrl("/");
  }
}
