import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type {
  ContextoEmision,
  DocumentoDetalle,
  DocumentoListado,
  DocumentoTributario,
  DocumentoTributarioRepository,
  FiltrosDocumentos,
  NuevoDocumento,
  Orden,
  OrdenEnvio,
  PlanEmision,
  PlanReembolso,
  ReembolsoRegistro,
  TipoDte
} from "@cotizapp/domain";
import type { DbClient } from "../db/client.js";
import { auditoriaLog } from "../db/schema/auditoria-log.schema.js";
import { documentoTributario } from "../db/schema/documento-tributario.schema.js";
import { orden } from "../db/schema/orden.schema.js";
import { ordenEnvio } from "../db/schema/orden-envio.schema.js";
import { ordenLinea } from "../db/schema/orden-linea.schema.js";
import { organizacion } from "../db/schema/organizacion.schema.js";
import { usuario } from "../db/schema/usuario.schema.js";

type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Lector = Pick<DbClient, "select">;

const toOrden = (f: typeof orden.$inferSelect): Orden => ({ ...f, requiereFactura: f.requiereFactura === 1 });
const toEnvio = (f: typeof ordenEnvio.$inferSelect): OrdenEnvio => ({ ...f });
const toDoc = (f: typeof documentoTributario.$inferSelect): DocumentoTributario => ({ ...f, tipoDte: f.tipoDte as TipoDte });

const MAX_REINTENTOS = 6;

// Errores transitorios al competir por el mismo folio: clave duplicada (1062) o deadlock (1213) / timeout de lock (1205).
function esConflictoDeFolio(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 4; i++) {
    const err = x as { errno?: number; code?: string; cause?: unknown };
    if (err.errno === 1062 || err.errno === 1213 || err.errno === 1205 || err.code === "ER_DUP_ENTRY" || err.code === "ER_LOCK_DEADLOCK") return true;
    x = err.cause;
  }
  return false;
}

export class DrizzleDocumentoTributarioRepository implements DocumentoTributarioRepository {
  constructor(private readonly db: DbClient) {}

  private async contexto(db: Lector, o: typeof orden.$inferSelect, bloquear = false): Promise<ContextoEmision> {
    const [cli] = await db
      .select({ rut: usuario.rut, nombre: usuario.nombre })
      .from(usuario)
      .where(eq(usuario.id, o.usuarioId));
    const [org] = await db
      .select({ rut: organizacion.rut, nombre: organizacion.razonSocial })
      .from(organizacion)
      .where(eq(organizacion.id, o.organizacionId));
    const envios = await db
      .select({ e: ordenEnvio, rut: organizacion.rut, nombre: organizacion.razonSocial })
      .from(ordenEnvio)
      .innerJoin(organizacion, eq(organizacion.id, ordenEnvio.proveedorId))
      .where(eq(ordenEnvio.ordenId, o.id))
      .orderBy(ordenEnvio.id);
    // Los documentos de la orden (boleta/factura/NC por orden_id; las guias tambien guardan orden_id).
    const q = db.select().from(documentoTributario).where(eq(documentoTributario.ordenId, o.id)).orderBy(documentoTributario.id);
    const docs = bloquear ? await (q as unknown as { for(m: "update"): typeof q }).for("update") : await q;
    return {
      orden: toOrden(o),
      clienteRut: cli?.rut ?? null,
      clienteNombre: cli?.nombre ?? "",
      organizacionRut: org?.rut ?? "",
      organizacionNombre: org?.nombre ?? "",
      envios: envios.map((x) => ({ envio: toEnvio(x.e), proveedorRut: x.rut, proveedorNombre: x.nombre })),
      documentos: docs.map(toDoc)
    };
  }

  async contextoOrden(ordenId: number) {
    const [o] = await this.db.select().from(orden).where(eq(orden.id, ordenId));
    return o ? this.contexto(this.db, o) : null;
  }

  async buscarOrdenIdPorCodigo(codigo: string) {
    const [o] = await this.db.select({ id: orden.id }).from(orden).where(eq(orden.codigo, codigo));
    return o?.id ?? null;
  }

  // Folio correlativo por (tipo, emisor): MAX(folio)+1 con lectura bloqueante dentro de la transaccion. Si dos
  // transacciones compiten, el indice unico (tipo_dte, folio, emisor_rut) garantiza que solo una gana y la otra
  // (clave duplicada o deadlock) se reintenta completa desde la nueva lectura.
  private async insertar(tx: Tx, n: NuevoDocumento): Promise<DocumentoTributario> {
    const [m] = await tx
      .select({ max: sql<number | null>`max(${documentoTributario.folio})` })
      .from(documentoTributario)
      .where(and(eq(documentoTributario.tipoDte, n.tipoDte), eq(documentoTributario.emisorRut, n.emisorRut)))
      .for("update");
    const folio = Number(m?.max ?? 0) + 1;
    const [res] = await tx.insert(documentoTributario).values({
      tipoDte: n.tipoDte,
      folio,
      ordenId: n.ordenId,
      ordenEnvioId: n.ordenEnvioId,
      emisorRut: n.emisorRut,
      receptorRut: n.receptorRut,
      neto: n.neto,
      iva: n.iva,
      total: n.total,
      // SIMULADO: no hay envio real al SII; se "acepta" de inmediato con un track id ficticio.
      estadoSii: "aceptado",
      trackIdSii: `SIM-${n.tipoDte}-${folio}`,
      emitidoEn: new Date()
    });
    const [fila] = await tx.select().from(documentoTributario).where(eq(documentoTributario.id, Number(res.insertId)));
    return toDoc(fila);
  }

  private async conReintentos<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 1; ; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i >= MAX_REINTENTOS || !esConflictoDeFolio(e)) throw e;
        await new Promise((r) => setTimeout(r, 10 * i + Math.random() * 30));
      }
    }
  }

  private async bloquearOrden(tx: Tx, ordenId: number) {
    const [o] = await tx.select().from(orden).where(eq(orden.id, ordenId)).for("update");
    if (!o) throw new Error(`Orden ${ordenId} inexistente`);
    return o;
  }

  emitirParaOrden(ordenId: number, planificar: (ctx: ContextoEmision) => Promise<PlanEmision>) {
    return this.conReintentos(() =>
      this.db.transaction(async (tx) => {
        const o = await this.bloquearOrden(tx, ordenId);
        const plan = await planificar(await this.contexto(tx, o));
        const emitidos: DocumentoTributario[] = [];
        for (const n of plan.documentos) emitidos.push(await this.insertar(tx, n));
        const auditoria = plan.auditoria(emitidos);
        if (auditoria.length) await tx.insert(auditoriaLog).values(auditoria);
        return emitidos;
      })
    );
  }

  registrarReembolso(ordenId: number, planificar: (ctx: ContextoEmision) => Promise<PlanReembolso>) {
    return this.conReintentos(() =>
      this.db.transaction(async (tx) => {
        const o = await this.bloquearOrden(tx, ordenId);
        const plan = await planificar(await this.contexto(tx, o));
        const nota = await this.insertar(tx, plan.nota);
        const cambios: Partial<typeof orden.$inferInsert> = {};
        if (plan.estadoPago) cambios.estadoPago = plan.estadoPago;
        if (plan.estadoOrden) cambios.estado = plan.estadoOrden;
        if (Object.keys(cambios).length) await tx.update(orden).set(cambios).where(eq(orden.id, ordenId));
        await tx.insert(auditoriaLog).values(plan.auditoria(nota));
        return nota;
      })
    );
  }

  async listar(f: FiltrosDocumentos) {
    const filtros: SQL[] = [];
    if (f.alcance.tipo === "cliente") filtros.push(eq(orden.usuarioId, f.alcance.usuarioId));
    if (f.alcance.tipo === "proveedor") {
      filtros.push(eq(documentoTributario.tipoDte, 52), eq(ordenEnvio.proveedorId, f.alcance.proveedorId));
    }
    if (f.ordenId !== undefined) filtros.push(eq(documentoTributario.ordenId, f.ordenId));
    if (f.tipo !== undefined) filtros.push(eq(documentoTributario.tipoDte, f.tipo));
    const donde = filtros.length ? and(...filtros) : undefined;
    const base = () =>
      this.db
        .select({ d: documentoTributario, codigo: orden.codigo })
        .from(documentoTributario)
        .innerJoin(orden, eq(orden.id, documentoTributario.ordenId))
        .leftJoin(ordenEnvio, eq(ordenEnvio.id, documentoTributario.ordenEnvioId))
        .where(donde);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(documentoTributario)
      .innerJoin(orden, eq(orden.id, documentoTributario.ordenId))
      .leftJoin(ordenEnvio, eq(ordenEnvio.id, documentoTributario.ordenEnvioId))
      .where(donde);
    const filas = await base()
      .orderBy(desc(documentoTributario.id))
      .limit(f.tamano)
      .offset((f.pagina - 1) * f.tamano);
    return { items: filas.map((r): DocumentoListado => ({ ...toDoc(r.d), ordenCodigo: r.codigo })), total: Number(total) };
  }

  async buscarDetalle(id: number): Promise<DocumentoDetalle | null> {
    const [fila] = await this.db
      .select({ d: documentoTributario, o: orden, proveedorId: ordenEnvio.proveedorId })
      .from(documentoTributario)
      .innerJoin(orden, eq(orden.id, documentoTributario.ordenId))
      .leftJoin(ordenEnvio, eq(ordenEnvio.id, documentoTributario.ordenEnvioId))
      .where(eq(documentoTributario.id, id));
    if (!fila) return null;
    const documento = toDoc(fila.d);
    const nombrePorRut = async (rut: string | null, porDefecto: string) => {
      if (!rut) return porDefecto;
      const [org] = await this.db.select({ n: organizacion.razonSocial }).from(organizacion).where(eq(organizacion.rut, rut));
      if (org) return org.n;
      const [u] = await this.db.select({ n: usuario.nombre }).from(usuario).where(eq(usuario.rut, rut));
      return u?.n ?? porDefecto;
    };
    const [cli] = await this.db.select({ n: usuario.nombre }).from(usuario).where(eq(usuario.id, fila.o.usuarioId));

    const enviosIds = documento.ordenEnvioId
      ? [documento.ordenEnvioId]
      : (await this.db.select({ id: ordenEnvio.id }).from(ordenEnvio).where(eq(ordenEnvio.ordenId, fila.o.id))).map((e) => e.id);
    const lineas = enviosIds.length
      ? await this.db.select().from(ordenLinea).where(inArray(ordenLinea.ordenEnvioId, enviosIds)).orderBy(ordenLinea.id)
      : [];

    let referencia: DocumentoTributario | null = null;
    let motivo: string | null = null;
    if (documento.tipoDte === 61) {
      const [orig] = await this.db
        .select()
        .from(documentoTributario)
        .where(and(eq(documentoTributario.ordenId, fila.o.id), inArray(documentoTributario.tipoDte, [33, 39])))
        .orderBy(documentoTributario.id)
        .limit(1);
      referencia = orig ? toDoc(orig) : null;
      motivo = (await this.listarReembolsos(fila.o.id)).find((r) => r.nota.id === id)?.motivo ?? null;
    }
    return {
      documento,
      ordenCodigo: fila.o.codigo,
      ordenUsuarioId: fila.o.usuarioId,
      proveedorId: fila.proveedorId ?? null,
      emisorNombre: await nombrePorRut(documento.emisorRut, "Cotizapp SpA"),
      receptorNombre: await nombrePorRut(documento.receptorRut, cli?.n ?? "Cliente"),
      lineas: lineas.map((l) => ({
        nombre: l.nombreProducto,
        formato: l.formato,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        totalLinea: l.totalLinea
      })),
      referencia,
      motivo
    };
  }

  async listarReembolsos(ordenId: number): Promise<ReembolsoRegistro[]> {
    const notas = await this.db
      .select()
      .from(documentoTributario)
      .where(and(eq(documentoTributario.ordenId, ordenId), eq(documentoTributario.tipoDte, 61)))
      .orderBy(desc(documentoTributario.id));
    const auds = await this.db
      .select()
      .from(auditoriaLog)
      .where(and(eq(auditoriaLog.entidad, "orden"), eq(auditoriaLog.entidadId, ordenId), eq(auditoriaLog.accion, "reembolsar")));
    return notas.map((n) => {
      const a = auds.find((x) => (x.datosDespues as { notaCreditoId?: number } | null)?.notaCreditoId === n.id);
      return {
        nota: toDoc(n),
        motivo: (a?.datosDespues as { motivo?: string } | null)?.motivo ?? null,
        usuarioId: a?.usuarioId ?? null,
        creadoEn: a?.creadoEn ?? n.emitidoEn
      };
    });
  }
}
