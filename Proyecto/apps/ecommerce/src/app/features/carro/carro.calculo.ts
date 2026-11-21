import { FichaProducto, OfertaFicha } from "../../core/models/catalogo.models";
import { ItemCarro } from "../../core/state/carro.state";
import { cajasMinimas } from "../../shared/compra";
import { formatearClp } from "../../shared/formato";

// Arma el carro que se muestra (KAN-94) a partir de GET /carro y de la ficha
// de cada producto, que trae lo que el carro no: nombre del distribuidor,
// plazo, minimo, despacho a la comuna del comprador y el precio mas caro.
// Los montos siguen a planificarOrden del backend: subtotal = precio x cajas,
// despacho por distribuidor, gratis desde despacho_gratis_desde.

export interface LineaCarro {
  ofertaId: number;
  productoId: number | null;
  nombre: string;
  formato: string | null;
  imagenUrl: string | null;
  proveedorId: number | null;
  precioVisto: number;
  precioActual: number | null;
  cantidad: number;
  unidadesPorCaja: number | null;
  minimoCompra: number | null;
  /** Cajas minimas para cumplir el minimo de compra; el "–" no baja de aqui. */
  minCajas: number;
  cajasDisponibles: number | null;
  plazoHoras: number | null;
  subtotal: number;
  /** Lo que se ahorra frente al distribuidor mas caro del mismo producto. */
  ahorro: number;
  disponible: boolean;
  precioCambio: boolean;
  /** Pide mas cajas de las que quedan. */
  sinStock: boolean;
  bajoMinimo: boolean;
}

export type TipoDespacho = "despacho" | "gratis" | "retiro" | "sin-cobertura";

export interface GrupoCarro {
  proveedorId: number | null;
  nombre: string;
  lineas: LineaCarro[];
  plazoHoras: number | null;
  subtotal: number;
  despacho: { tipo: TipoDespacho; costo: number; gratisDesde: number | null };
  nota: string;
}

export interface ResumenCarro {
  grupos: GrupoCarro[];
  lineas: LineaCarro[];
  productos: number;
  subtotal: number;
  despachos: number;
  ahorro: number;
  total: number;
  cambiosDePrecio: LineaCarro[];
  noDisponibles: LineaCarro[];
  /** Lo que impide pagar, en palabras; vacio si se puede pasar al pago. */
  bloqueos: string[];
}

function ofertaEnFicha(ficha: FichaProducto | undefined, ofertaId: number): OfertaFicha | undefined {
  return ficha?.ofertas.find((o) => o.id === ofertaId);
}

function armarLinea(i: ItemCarro, ficha: FichaProducto | undefined): LineaCarro {
  const o = ofertaEnFicha(ficha, i.ofertaId);
  const precio = i.precioActual ?? i.precioVisto;
  const masCaro = ficha?.ofertas.length ? Math.max(...ficha.ofertas.map((x) => x.precioUnitario)) : precio;
  const minCajas = o ? cajasMinimas(o) : 1;
  return {
    ofertaId: i.ofertaId,
    productoId: i.productoId,
    nombre: i.nombreProducto ?? ficha?.nombre ?? "Producto",
    formato: i.formato ?? ficha?.formato ?? null,
    imagenUrl: ficha?.imagenUrl ?? null,
    proveedorId: i.proveedorId,
    precioVisto: i.precioVisto,
    precioActual: i.precioActual,
    cantidad: i.cantidad,
    unidadesPorCaja: o?.unidadesPorCaja ?? null,
    minimoCompra: o?.minimoCompra ?? null,
    minCajas,
    cajasDisponibles: i.cajasDisponibles,
    plazoHoras: o?.plazoHoras ?? null,
    subtotal: i.disponible ? precio * i.cantidad : 0,
    ahorro: i.disponible ? Math.max(0, masCaro - precio) * i.cantidad : 0,
    disponible: i.disponible,
    precioCambio: i.disponible && i.precioActual !== null && i.precioActual !== i.precioVisto,
    sinStock: i.disponible && i.cajasDisponibles !== null && i.cantidad > i.cajasDisponibles,
    bajoMinimo: i.disponible && i.cantidad < minCajas
  };
}

/** Datos del distribuidor sacados de cualquier ficha donde publique. */
function proveedorDe(proveedorId: number | null, fichas: ReadonlyMap<number, FichaProducto>, ofertaIds: number[]) {
  if (proveedorId === null) return undefined;
  const todas = [...fichas.values()].flatMap((f) => f.ofertas);
  // Primero una oferta del carro (su modalidad cuenta), si no cualquiera del distribuidor.
  return todas.find((o) => ofertaIds.includes(o.id)) ?? todas.find((o) => o.proveedor.id === proveedorId);
}

function despachoDe(oferta: OfertaFicha | undefined, ofertasDelGrupo: OfertaFicha[], subtotal: number): GrupoCarro["despacho"] {
  if (!oferta) return { tipo: "sin-cobertura", costo: 0, gratisDesde: null };
  const { costoDespacho, despachoGratisDesde } = oferta.proveedor;
  if (ofertasDelGrupo.length && ofertasDelGrupo.every((o) => o.modalidadEntrega === "retiro")) {
    return { tipo: "retiro", costo: 0, gratisDesde: despachoGratisDesde };
  }
  if (costoDespacho === null) return { tipo: "sin-cobertura", costo: 0, gratisDesde: despachoGratisDesde };
  if (despachoGratisDesde !== null && subtotal >= despachoGratisDesde) return { tipo: "gratis", costo: 0, gratisDesde: despachoGratisDesde };
  return { tipo: "despacho", costo: costoDespacho, gratisDesde: despachoGratisDesde };
}

function notaDespacho(nombre: string, d: GrupoCarro["despacho"]): string {
  const sobre = d.gratisDesde !== null ? formatearClp(d.gratisDesde) : null;
  switch (d.tipo) {
    case "gratis":
      return `Despacho de ${nombre}: gratis (sobre ${sobre})`;
    case "despacho":
      return `Despacho de ${nombre}: ${formatearClp(d.costo)}${sobre ? ` · gratis sobre ${sobre}` : ""}`;
    case "retiro":
      return `${nombre} solo entrega con retiro en su bodega, sin costo de despacho.`;
    case "sin-cobertura":
      return `${nombre} no despacha a tu comuna: en el pago puedes elegir retiro si lo ofrece.`;
  }
}

export function armarCarro(items: ItemCarro[], fichas: ReadonlyMap<number, FichaProducto>): ResumenCarro {
  const lineas = items.map((i) => armarLinea(i, i.productoId !== null ? fichas.get(i.productoId) : undefined));

  const porProveedor = new Map<number | null, LineaCarro[]>();
  for (const l of lineas) {
    const clave = l.disponible ? l.proveedorId : null;
    porProveedor.set(clave, [...(porProveedor.get(clave) ?? []), l]);
  }

  const grupos: GrupoCarro[] = [];
  for (const [proveedorId, ls] of porProveedor) {
    if (proveedorId === null) continue;
    const ids = ls.map((l) => l.ofertaId);
    const oferta = proveedorDe(proveedorId, fichas, ids);
    const ofertasDelGrupo = [...fichas.values()].flatMap((f) => f.ofertas).filter((o) => ids.includes(o.id));
    const subtotal = ls.reduce((s, l) => s + l.subtotal, 0);
    const nombre = oferta?.proveedor.nombre ?? "Distribuidor";
    const despacho = despachoDe(oferta, ofertasDelGrupo, subtotal);
    const plazos = ls.map((l) => l.plazoHoras).filter((p): p is number => p !== null);
    grupos.push({
      proveedorId,
      nombre,
      lineas: ls,
      plazoHoras: plazos.length ? Math.max(...plazos) : null,
      subtotal,
      despacho,
      nota: notaDespacho(nombre, despacho)
    });
  }

  const noDisponibles = lineas.filter((l) => !l.disponible);
  const cambiosDePrecio = lineas.filter((l) => l.precioCambio);
  const subtotal = grupos.reduce((s, g) => s + g.subtotal, 0);
  const despachos = grupos.reduce((s, g) => s + g.despacho.costo, 0);

  const bloqueos: string[] = [];
  if (noDisponibles.length) bloqueos.push("Quita los productos que ya no están disponibles.");
  if (cambiosDePrecio.length) bloqueos.push("Acepta los precios que cambiaron.");
  if (lineas.some((l) => l.sinStock)) bloqueos.push("Ajusta las cantidades al stock que queda.");
  if (lineas.some((l) => l.bajoMinimo)) bloqueos.push("Hay productos bajo el mínimo de compra.");

  return {
    grupos,
    lineas,
    productos: lineas.length,
    subtotal,
    despachos,
    ahorro: lineas.reduce((s, l) => s + l.ahorro, 0),
    total: subtotal + despachos,
    cambiosDePrecio,
    noDisponibles,
    bloqueos
  };
}
