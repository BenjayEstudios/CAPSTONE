import { mysqlTable, bigint, smallint, int, varchar, datetime, mysqlEnum, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { orden } from "./orden.schema.js";
import { ordenEnvio } from "./orden-envio.schema.js";

// DTE del SII. La guia de despacho (52) se asocia al ENVIO (orden_envio_id);
// la boleta (39) o factura (33) a la ORDEN (orden_id); nota de credito (61)
// para reembolsos. Folio irrepetible por (tipo_dte, folio, emisor_rut).
export const documentoTributario = mysqlTable(
  "documento_tributario",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    // 33 factura, 39 boleta, 52 guia, 61 nota de credito.
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
    estadoSii: mysqlEnum("estado_sii", ["pendiente", "enviado", "aceptado", "rechazado"]).notNull().default("pendiente"),
    xmlUrl: varchar("xml_url", { length: 300 }),
    pdfUrl: varchar("pdf_url", { length: 300 }),
    emitidoEn: datetime("emitido_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("ix_documento_tributario_tipo_dte").on(table.tipoDte),
    index("ix_documento_tributario_estado_sii").on(table.estadoSii),
    uniqueIndex("ux_documento_tributario_tipo_folio_emisor").on(table.tipoDte, table.folio, table.emisorRut)
  ]
);
