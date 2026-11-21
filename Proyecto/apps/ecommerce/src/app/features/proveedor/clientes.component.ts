import { Component, inject, signal } from "@angular/core";
import { ClienteProveedor, Recompra, VentasProveedorService } from "../../core/proveedor/ventas-proveedor.service";
import { formatearClp } from "../../shared/formato";

const TAMANO = 50;
const FECHA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });

/** "76111222-8" -> "76.111.222-8" */
export function formatearRut(rut: string): string {
  const [cuerpo, dv] = rut.replace(/\./g, "").split("-");
  if (!cuerpo || !dv) return rut;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

/** Linea de contacto bajo el nombre: "compras@x.cl · 76.111.222-8 · +56 2 2274 5566". */
export function lineaContacto(c: NonNullable<ClienteProveedor["contacto"]>): string {
  return [c.email, formatearRut(c.rut), c.telefono].filter(Boolean).join(" · ");
}

/** Los clientes que vuelven seguido se destacan; el resto va neutro. */
export function tonoRecompra(r: Recompra): "frecuente" | "aviso" | "neutro" {
  if (r === "Semanal" || r === "Quincenal" || r === "Mensual") return "frecuente";
  return r === "Por pagar" ? "aviso" : "neutro";
}

// /proveedor/clientes (KAN-106): quien le compro al proveedor al menos una
// vez, de quien mas compro a quien menos: cliente, tipo, comuna, ordenes,
// monto comprado, ultima compra y recompra. El contacto (email, RUT,
// telefono) lo manda el backend solo desde la primera orden pagada.
@Component({
  selector: "app-clientes-proveedor",
  standalone: true,
  templateUrl: "./clientes.component.html",
  styleUrl: "./clientes.component.css"
})
export class ClientesProveedorComponent {
  private readonly servicio = inject(VentasProveedorService);

  readonly clientes = signal<ClienteProveedor[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly estado = signal<"cargando" | "ok" | "error">("cargando");
  readonly cargandoMas = signal(false);

  readonly clp = formatearClp;
  readonly contacto = lineaContacto;
  readonly tono = tonoRecompra;
  readonly fecha = (iso: string) => FECHA.format(new Date(iso)).replace(".", "");

  constructor() {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.estado.set("cargando");
    try {
      const r = await this.servicio.clientes(1, TAMANO);
      this.clientes.set(r.items);
      this.total.set(r.total);
      this.pagina.set(1);
      this.estado.set("ok");
    } catch {
      this.estado.set("error");
    }
  }

  async verMas(): Promise<void> {
    if (this.cargandoMas()) return;
    this.cargandoMas.set(true);
    try {
      const r = await this.servicio.clientes(this.pagina() + 1, TAMANO);
      const vistos = new Set(this.clientes().map((c) => c.organizacionId));
      this.clientes.update((l) => [...l, ...r.items.filter((c) => !vistos.has(c.organizacionId))]);
      this.total.set(r.total);
      this.pagina.update((p) => p + 1);
    } catch {
      // Queda el boton para reintentar.
    } finally {
      this.cargandoMas.set(false);
    }
  }
}
