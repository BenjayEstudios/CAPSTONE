import {
  mysqlTable,
  bigint,
  int,
  smallint,
  varchar,
  mysqlEnum,
  datetime,
  index,
  uniqueIndex
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { orden } from "./orden.schema.js";
import { ordenEnvio } from "./orden-envio.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table documento_tributario (DTE
// del SII). tipo_dte: 33 factura, 39 boleta, 52 guia, 61 nota de credito.
// Guia (52) -> orden_envio_id; boleta/factura -> orden_id. Folio irrepetible
// por (tipo_dte, folio, emisor_rut).
export const documentoTributario = mysqlTable(
  "documento_tributario",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    tipoDte: smallint("tipo_dte").notNull(),
    folio: int("folio", { unsigned: true }).notNull(),
    ordenId: bigint("orden_id", { mode: "number" }).references(() => orden.id),
    ordenEnvioId: bigint("orden_envio_id", { mode: "number" }).references(() => ordenEnvio.id),
    emisorRut: varchar("emisor_rut", { length: 12 }).notNull(),
    receptorRut: varchar("receptor_rut", { length: 12 }),
    neto: int("neto", { unsigned: true }),
    iva: int("iva", { unsigned: true }),
    total: int("total", { unsigned: true }).notNull(),
    trackIdSii: varchar("track_id_sii", { length: 40 }),
    estadoSii: mysqlEnum("estado_sii", ["pendiente", "enviado", "aceptado", "rechazado"])
      .notNull()
      .default("pendiente"),
    xmlUrl: varchar("xml_url", { length: 300 }),
    pdfUrl: varchar("pdf_url", { length: 300 }),
    emitidoEn: datetime("emitido_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [
    index("documento_tributario_tipo_dte_idx").on(t.tipoDte),
    index("documento_tributario_estado_sii_idx").on(t.estadoSii),
    uniqueIndex("documento_tributario_folio_uq").on(t.tipoDte, t.folio, t.emisorRut)
  ]
);
