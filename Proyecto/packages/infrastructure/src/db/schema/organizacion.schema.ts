import {
  mysqlTable,
  bigint,
  varchar,
  mysqlEnum,
  decimal,
  smallint,
  time,
  int,
  tinyint,
  datetime,
  index
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { direccion } from "./direccion.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table organizacion. Las columnas
// "solo proveedor" son nullable (quedan NULL si tipo = cliente | interna).
// tinyint(1) -> tinyint; "int unsigned" -> int({ unsigned: true }).
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
    ofreceDespacho: tinyint("ofrece_despacho"),
    ofreceRetiro: tinyint("ofrece_retiro"),
    entregasATiempoPct: decimal("entregas_a_tiempo_pct", { precision: 5, scale: 2 }),
    banco: varchar("banco", { length: 60 }),
    cuentaBancaria: varchar("cuenta_bancaria", { length: 40 }),
    creadaEn: datetime("creada_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [index("organizacion_tipo_idx").on(t.tipo)]
);
