import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDbClient } from "../db/client.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { rol } from "../db/schema/rol.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

// Catalogo de codigos de permiso (nota de la tabla rol en DataBase/dbDiagram.sql).
const CODIGOS_PERMISO = [
  "crear_producto",
  "cargar_imagenes",
  "aprobar_proveedor",
  "ver_todas_ordenes",
  "ver_ordenes_propias",
  "publicar_precio_stock",
  "emitir_reembolso",
  "liquidar_proveedor",
  "crear_usuario",
  "cambiar_permisos",
  "ver_auditoria"
] as const;

const RUT_INTERNA = "00000000-0";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const clave = process.env.SEED_ADMIN_PASSWORD;
  const nombre = process.env.SEED_ADMIN_NOMBRE?.trim() || "Administrador";
  const databaseUrl = process.env.DATABASE_URL;

  if (!email || !clave) {
    console.error("Faltan SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD. No se creo nada.");
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error("Falta DATABASE_URL. No se creo nada.");
    process.exit(1);
  }

  const { db, pool } = createDbClient(databaseUrl);
  try {
    let [org] = await db.select().from(organizacion).where(eq(organizacion.tipo, "interna")).limit(1);
    if (!org) {
      const [{ id }] = await db
        .insert(organizacion)
        .values({ tipo: "interna", razonSocial: "Cotizapp", rut: RUT_INTERNA, nombreFantasia: "Cotizapp", estado: "activa" })
        .$returningId();
      [org] = await db.select().from(organizacion).where(eq(organizacion.id, id));
      console.log("Organizacion interna creada");
    } else {
      console.log("Organizacion interna ya existia");
    }

    let [rolAdmin] = await db.select().from(rol).where(eq(rol.codigo, "administrador")).limit(1);
    if (!rolAdmin) {
      const permisos = Object.fromEntries(CODIGOS_PERMISO.map((c) => [c, "total"]));
      const [{ id }] = await db
        .insert(rol)
        .values({
          codigo: "administrador",
          nombre: "Administrador general",
          descripcion: "Acceso total al sitio administrativo",
          esSistema: 1,
          permisos
        })
        .$returningId();
      [rolAdmin] = await db.select().from(rol).where(eq(rol.id, id));
      console.log("Rol administrador creado");
    } else {
      console.log("Rol administrador ya existia");
    }

    const [existente] = await db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email)).limit(1);
    if (existente) {
      console.log("Usuario administrador ya existia (no se modifica)");
    } else {
      const hashClave = await bcrypt.hash(clave, 10);
      await db.insert(usuario).values({
        organizacionId: org.id,
        rolId: rolAdmin.id,
        nombre,
        email,
        hashClave,
        mfaEstado: "inactivo",
        estado: "activo"
      });
      console.log("Usuario administrador creado");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed fallido:", err instanceof Error ? err.message : "error desconocido");
  process.exit(1);
});
