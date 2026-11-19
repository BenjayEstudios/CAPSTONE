import { Component, inject } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { RouterOutlet } from "@angular/router";
import { BRAND } from "./core/config/brand";
import { SessionState } from "./core/state/session.state";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent {
  readonly session = inject(SessionState);

  constructor() {
    inject(Title).setTitle(`${BRAND.nombre} · ${BRAND.producto}`);
  }
}
