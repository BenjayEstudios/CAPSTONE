import type { AlmacenArchivos } from "@cotizapp/domain";
import { AlmacenLocal } from "@cotizapp/infrastructure";
import type { Env } from "../config/env.js";

// Selector del adaptador de almacenamiento segun STORAGE_DRIVER.
// Punto de extension: para DigitalOcean Spaces crear en
// @cotizapp/infrastructure una clase AlmacenSpaces (S3-compatible) que
// implemente AlmacenArchivos, agregar "spaces" al enum STORAGE_DRIVER de
// config/env.ts (con sus credenciales) y un `case "spaces"` aqui. Ninguna
// ruta ni caso de uso cambia. NO esta implementado todavia.
export function crearAlmacenArchivos(env: Pick<Env, "STORAGE_DRIVER" | "UPLOADS_DIR" | "PUBLIC_BASE_URL">): AlmacenArchivos {
  switch (env.STORAGE_DRIVER) {
    case "local":
      return new AlmacenLocal({ directorio: env.UPLOADS_DIR, urlBase: env.PUBLIC_BASE_URL });
  }
}
