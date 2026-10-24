import { inject, Injectable } from "@angular/core";
import { ApiClient } from "../../core/api/api.client";
import { Categoria, CategoriaActualizar, CategoriaCrear } from "./categorias.models";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const MENSAJES: Record<string, string> = {
  SLUG_DUPLICADO: "Ya existe una categoría con ese slug.",
  ARBOL_MAXIMO_2_NIVELES: "Solo se permiten dos niveles: una subcategoría no puede tener hijos.",
  VALIDACION: "Los datos ingresados no son válidos."
};

export function mensajeDeError(err: unknown): string {
  const e = (err as { error?: ApiErrorBody })?.error?.error;
  if (e?.code && MENSAJES[e.code]) return e.message ? `${MENSAJES[e.code]} (${e.message})` : MENSAJES[e.code];
  return e?.message ?? "No se pudo completar la operación. Intenta nuevamente.";
}

@Injectable({ providedIn: "root" })
export class CategoriasService {
  private readonly api = inject(ApiClient);

  listarArbol() {
    return this.api.get<Categoria[]>("/categorias?incluirOcultas=true&arbol=true");
  }

  crear(body: CategoriaCrear) {
    return this.api.post<Categoria>("/categorias", body);
  }

  actualizar(id: string, body: CategoriaActualizar) {
    return this.api.patch<Categoria>(`/categorias/${id}`, body);
  }
}
