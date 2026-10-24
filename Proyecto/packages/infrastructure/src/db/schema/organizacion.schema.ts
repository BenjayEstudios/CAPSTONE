import { mysqlTable, bigint, varchar, decimal, smallint, time, int, boolean, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { direccion } from "./direccion.schema.js";

// FUSION: incluye lo que antes era la tabla proveedor (relacion 1:1). Las
// columnas marcadas "solo proveedor" quedan NULL cuando tipo IN
// ('cliente','interna'). Empresa compradora, proveedor o equipo interno;
// concentra los datos legales.
export const organizacion = mysqlTable(
  "organizacion",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    tipo: mysqlEnum("tipo", ["cliente", "proveedor", "interna"]).notNull(),
    razonSocial: varchar("razon_social", { length: 180 }).notNull(),
    rut: varchar("rut", { length: 12 }).notNull().unique(),
    nombreFantasia: varchar("nombre_fantasia", { length: 180 }),
    giro: varchar("giro", { length: 180 }),
    emailContacto: varchar("email_contacto", { length: 160 }),
    telefono: varchar("telefono", { length: 24 }),
    direccionId: bigint("direccion_id", { mode: "number" }).references(() => direccion.id),
    estado: mysqlEnum("estado", ["activa", "en_revision", "suspendida"]).notNull().default("en_revision"),
    comisionPct: decimal("comision_pct", { precision: 5, scale: 2 }),
    plazoEstandarHoras: smallint("plazo_estandar_horas"),
    plazoFueraRegionHoras: smallint("plazo_fuera_region_horas"),
    horaCorte: time("hora_corte"),
    despachoGratisDesde: int("despacho_gratis_desde", { unsigned: true }),
    ofreceDespacho: boolean("ofrece_despacho"),
    ofreceRetiro: boolean("ofrece_retiro"),
    entregasATiempoPct: decimal("entregas_a_tiempo_pct", { precision: 5, scale: 2 }),
    banco: varchar("banco", { length: 60 }),
    cuentaBancaria: varchar("cuenta_bancaria", { length: 40 }),
    creadaEn: datetime("creada_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("ix_organizacion_tipo").on(table.tipo)]
);
