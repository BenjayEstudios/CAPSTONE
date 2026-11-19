import { HttpErrorResponse } from "@angular/common/http";
import { ImagenProducto, ProductoPayload } from "../../core/models/catalogo.models";

export const ANCHO_MINIMO = 1200;
export const MAX_IMAGENES = 10;
export const MAX_BYTES = 5 * 1024 * 1024;
export const TIPOS_IMAGEN = ["image/jpeg", "image/png"];

export interface FormProducto {
  nombre: string;
  sku: string;
  ean: string;
  categoriaId: string;
  marca: string;
  formato: string;
  contenido: string;
  unidad: string;
  descripcion: string;
  precioReferencia: string;
  topeSobreReferenciaPct: string;
}

export const FORM_VACIO: FormProducto = {
  nombre: "", sku: "", ean: "", categoriaId: "", marca: "", formato: "", contenido: "",
  unidad: "unidad", descripcion: "", precioReferencia: "", topeSobreReferenciaPct: ""
};

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

// Validacion comun (borrador y publicar). Devuelve mensajes por campo.
export function validarBorrador(f: FormProducto): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.nombre.trim()) e["nombre"] = "El nombre es obligatorio.";
  else if (f.nombre.trim().length > 180) e["nombre"] = "Maximo 180 caracteres.";
  const sku = f.sku.trim().toUpperCase();
  if (!sku) e["sku"] = "El SKU es obligatorio.";
  else if (sku.length > 24 || !/^[A-Z0-9._-]+$/.test(sku)) e["sku"] = "SKU invalido: hasta 24 caracteres (letras, numeros, . _ -).";
  if (f.ean.trim() && !/^\d{8,14}$/.test(f.ean.trim())) e["ean"] = "EAN invalido: 8 a 14 digitos.";
  if (!f.categoriaId) e["categoriaId"] = "Selecciona una categoria.";
  if (!["kg", "L", "unidad"].includes(f.unidad)) e["unidad"] = "Selecciona una unidad.";
  const cont = num(f.contenido);
  if (cont !== null && (!(cont > 0) || cont > 9999999.999)) e["contenido"] = "Debe ser un numero mayor a 0.";
  const precio = num(f.precioReferencia);
  if (precio !== null && (!Number.isInteger(precio) || precio <= 0)) e["precioReferencia"] = "Debe ser un entero CLP mayor a 0.";
  const tope = num(f.topeSobreReferenciaPct);
  if (tope !== null) {
    if (!Number.isInteger(tope) || tope < 0 || tope > 100) e["topeSobreReferenciaPct"] = "Debe ser un entero entre 0 y 100.";
    else if (precio === null) e["topeSobreReferenciaPct"] = "El tope exige un precio de referencia.";
  }
  if (f.descripcion.length > 5000) e["descripcion"] = "Maximo 5000 caracteres.";
  return e;
}

// Lo que falta para publicar: nombre, categoria, precio ref > 0 y 1 imagen principal.
export function faltantesPublicar(f: FormProducto, imagenes: ImagenProducto[]): string[] {
  const faltan: string[] = [];
  if (!f.nombre.trim()) faltan.push("nombre");
  if (!f.categoriaId) faltan.push("categoria");
  const precio = num(f.precioReferencia);
  if (precio === null || !(precio > 0)) faltan.push("precio de referencia mayor a 0");
  if (imagenes.filter((i) => i.esPrincipal).length !== 1) faltan.push("exactamente 1 imagen principal");
  return faltan;
}

export function aPayload(f: FormProducto): ProductoPayload {
  const t = (v: string) => v.trim() || null;
  return {
    nombre: f.nombre.trim(),
    sku: f.sku.trim().toUpperCase(),
    ean: t(f.ean),
    categoriaId: Number(f.categoriaId),
    marca: t(f.marca),
    formato: t(f.formato),
    contenido: num(f.contenido),
    unidad: f.unidad as ProductoPayload["unidad"],
    descripcion: t(f.descripcion),
    precioReferencia: num(f.precioReferencia),
    topeSobreReferenciaPct: num(f.topeSobreReferenciaPct)
  };
}

export function validarArchivo(a: { type: string; size: number }): string | null {
  if (!TIPOS_IMAGEN.includes(a.type)) return "Formato no soportado: solo JPG o PNG.";
  if (a.size > MAX_BYTES) return "El archivo supera el maximo de 5 MB.";
  return null;
}

export function validarAncho(ancho: number): string | null {
  return ancho < ANCHO_MINIMO ? `La imagen debe tener al menos ${ANCHO_MINIMO} px de ancho (tiene ${ancho} px).` : null;
}

export function mensajeError(err: unknown): string {
  const e = err as HttpErrorResponse;
  if (e?.status === 0) return "No se pudo conectar con el servidor.";
  if (e?.status === 403) return "Tu rol no tiene permiso para realizar esta accion.";
  if (e?.status === 413) return "El archivo es demasiado grande (maximo ~5 MB).";
  const c = e?.error?.error;
  const m = c?.message as string | undefined;
  switch (c?.code) {
    case "SKU_DUPLICADO": return "Ya existe un producto con ese SKU.";
    case "EAN_DUPLICADO": return "Ya existe un producto con ese EAN.";
    case "CATEGORIA_NO_EXISTE": return "La categoria seleccionada no existe.";
    case "PRECIO_INCOHERENTE": return m ?? "El precio es incoherente con el precio de referencia o el tope.";
    case "PUBLICACION_INCOMPLETA": return m ? `No se puede publicar: ${m}` : "No se puede publicar: faltan datos.";
    case "FORMATO_NO_SOPORTADO": return "Formato no soportado: solo JPG o PNG.";
    case "IMAGEN_MUY_PEQUENA": return m ?? `La imagen debe tener al menos ${ANCHO_MINIMO} px de ancho.`;
    case "VALIDACION": return m ? `Datos invalidos: ${m}` : "Datos invalidos.";
    default: return m ?? "Ocurrio un error inesperado.";
  }
}

// Mueve el elemento i en delta posiciones y renumera orden.
export function mover<T extends { orden?: number }>(lista: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const c = [...lista];
  [c[i], c[j]] = [c[j], c[i]];
  return c.map((x, k) => ({ ...x, orden: k }));
}
