import { effect, inject, Injectable, signal, untracked } from "@angular/core";
import { CatalogoService } from "../../core/catalogo/catalogo.service";
import { FichaProducto } from "../../core/models/catalogo.models";
import { CarroState } from "../../core/state/carro.state";

// Fichas de los productos del carro, por productoId (KAN-94/95): traen lo que
// GET /carro no trae (distribuidor, plazo, minimo, despacho, precio mas caro).
// Se provee en cada pantalla (carro, checkout) para leer precios frescos al
// entrar; carga solo las que faltan cuando cambia el carro.
@Injectable()
export class FichasDelCarro {
  private readonly catalogo = inject(CatalogoService);
  private readonly carro = inject(CarroState);
  readonly fichas = signal<ReadonlyMap<number, FichaProducto>>(new Map());

  constructor() {
    effect(() => {
      const ids = [...new Set(this.carro.items().map((i) => i.productoId).filter((id): id is number => id !== null))];
      untracked(() => void this.cargar(ids));
    });
  }

  private async cargar(ids: number[]): Promise<void> {
    const faltan = ids.filter((id) => !this.fichas().has(id));
    if (!faltan.length) return;
    const leidas = await Promise.allSettled(faltan.map((id) => this.catalogo.ficha(id)));
    const mapa = new Map(this.fichas());
    // Un producto que ya no esta publicado da 404: su linea se muestra con lo que trae el carro.
    leidas.forEach((r) => r.status === "fulfilled" && mapa.set(r.value.id, r.value));
    this.fichas.set(mapa);
  }
}
