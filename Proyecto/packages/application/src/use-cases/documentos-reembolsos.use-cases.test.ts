import { describe, expect, it } from "vitest";
import type {
  ContextoEmision,
  DocumentoDetalle,
  DocumentoTributario,
  DocumentoTributarioRepository,
  NuevoDocumento,
  Orden,
  OrdenEnvio,
  PlanEmision,
  PlanReembolso,
  RegistroAuditoria
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { desglosarIva, emitirDocumentosOrden } from "./documentos-tributarios.use-cases.js";
import { generarPdfDocumento } from "./documento-pdf.js";
import { buscarReembolsosPorCodigo, crearReembolso, listarReembolsosOrden } from "./reembolsos.use-cases.js";

const orden = (id: number, extra: Partial<Orden> = {}): Orden => ({
  id,
  codigo: `CM-${id}`,
  usuarioId: 5,
  organizacionId: 4,
  direccionEntregaId: null,
  subtotal: 9000,
  costoDespachoTotal: 1000,
  comisionTotal: 500,
  total: 10000,
  requiereFactura: false,
  estado: "pagada",
  medioPago: "tarjeta",
  estadoPago: "pagado",
  referenciaPasarela: "ref",
  creadaEn: new Date(),
  pagadoEn: new Date(),
  ...extra
});
const envio = (id: number, ordenId: number, proveedorId: number, extra: Partial<OrdenEnvio> = {}): OrdenEnvio => ({
  id,
  ordenId,
  proveedorId,
  modalidad: "despacho",
  puntoRetiroId: null,
  direccionEntregaId: null,
  plazoHoras: 48,
  costoDespacho: 500,
  subtotal: 4500,
  comisionPct: "5.00",
  comisionMonto: 225,
  estado: "por_despachar",
  liquidacionId: null,
  montoBrutoLiquidado: null,
  comisionLiquidada: null,
  montoNetoLiquidado: null,
  actualizadoEn: new Date(),
  ...extra
});

// Repositorio en memoria: una cola serializa las "transacciones" como lo hace el lock de la orden + el indice unico.
class RepoMem implements DocumentoTributarioRepository {
  ordenes = new Map<number, Orden>();
  envios: OrdenEnvio[] = [];
  docs: DocumentoTributario[] = [];
  audit: RegistroAuditoria[] = [];
  private cola: Promise<unknown> = Promise.resolve();
  private seq = 0;

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const r = this.cola.then(fn, fn);
    this.cola = r.catch(() => undefined);
    return r;
  }
  private ctx(id: number): ContextoEmision {
    const o = this.ordenes.get(id) as Orden;
    return {
      orden: { ...o },
      clienteRut: "11111111-1",
      clienteNombre: "Cliente",
      organizacionRut: "77777777-7",
      organizacionNombre: "Org SpA",
      envios: this.envios.filter((e) => e.ordenId === id).map((e) => ({ envio: e, proveedorRut: `9000000${e.proveedorId}-K`, proveedorNombre: "Prov" })),
      documentos: this.docs.filter((d) => d.ordenId === id)
    };
  }
  private insertar(n: NuevoDocumento): DocumentoTributario {
    const folio = Math.max(0, ...this.docs.filter((d) => d.tipoDte === n.tipoDte && d.emisorRut === n.emisorRut).map((d) => d.folio)) + 1;
    const d: DocumentoTributario = { ...n, id: ++this.seq, folio, trackIdSii: `SIM-${folio}`, estadoSii: "aceptado", xmlUrl: null, pdfUrl: null, emitidoEn: new Date() };
    this.docs.push(d);
    return d;
  }
  async contextoOrden(id: number) {
    return this.ordenes.has(id) ? this.ctx(id) : null;
  }
  async buscarOrdenIdPorCodigo(codigo: string) {
    return [...this.ordenes.values()].find((o) => o.codigo === codigo)?.id ?? null;
  }
  emitirParaOrden(id: number, planificar: (c: ContextoEmision) => Promise<PlanEmision>) {
    return this.serial(async () => {
      await Promise.resolve();
      const plan = await planificar(this.ctx(id));
      const nuevos = plan.documentos.map((n) => this.insertar(n));
      this.audit.push(...plan.auditoria(nuevos));
      return nuevos;
    });
  }
  registrarReembolso(id: number, planificar: (c: ContextoEmision) => Promise<PlanReembolso>) {
    return this.serial(async () => {
      const plan = await planificar(this.ctx(id));
      const nota = this.insertar(plan.nota);
      const o = this.ordenes.get(id) as Orden;
      if (plan.estadoPago) o.estadoPago = plan.estadoPago;
      if (plan.estadoOrden) o.estado = plan.estadoOrden;
      this.audit.push(...plan.auditoria(nota));
      return nota;
    });
  }
  async listar(): Promise<never> {
    throw new Error("no usado");
  }
  async buscarDetalle(): Promise<DocumentoDetalle | null> {
    return null;
  }
  async listarReembolsos(id: number) {
    return this.docs
      .filter((d) => d.ordenId === id && d.tipoDte === 61)
      .map((nota) => ({
        nota,
        motivo: (this.audit.find((a) => (a.datosDespues as { notaCreditoId: number }).notaCreditoId === nota.id)?.datosDespues as { motivo: string } | undefined)?.motivo ?? null,
        usuarioId: 1,
        creadoEn: nota.emitidoEn
      }));
  }
}

const nuevoRepo = (...ordenes: Orden[]) => {
  const r = new RepoMem();
  ordenes.forEach((o) => r.ordenes.set(o.id, o));
  return r;
};
const codigo = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as ErrorAplicacion | null)?.code;

describe("desglosarIva", () => {
  it("neto + iva = total", () => {
    expect(desglosarIva(11900)).toEqual({ neto: 10000, iva: 1900 });
    const { neto, iva } = desglosarIva(10001);
    expect(neto + iva).toBe(10001);
  });
});

describe("emitirDocumentosOrden", () => {
  it("emite boleta (39) y una guia (52) por envio no cancelado con el emisor correcto", async () => {
    const repo = nuevoRepo(orden(1));
    repo.envios.push(envio(1, 1, 2), envio(2, 1, 3), envio(3, 1, 4, { estado: "cancelado" }));
    const r = await emitirDocumentosOrden({ documentoRepository: repo })(1, 9);
    expect(r.nuevos).toBe(3);
    expect(repo.docs.map((d) => d.tipoDte).sort()).toEqual([39, 52, 52]);
    const boleta = repo.docs.find((d) => d.tipoDte === 39) as DocumentoTributario;
    expect(boleta).toMatchObject({ total: 10000, receptorRut: "11111111-1", emisorRut: "76000000-0", estadoSii: "aceptado" });
    expect(repo.docs.filter((d) => d.tipoDte === 52).map((d) => d.emisorRut)).toEqual(["90000002-K", "90000003-K"]);
    expect(repo.audit).toHaveLength(3);
  });

  it("emite factura (33) a nombre de la organizacion si requiere factura", async () => {
    const repo = nuevoRepo(orden(1, { requiereFactura: true }));
    await emitirDocumentosOrden({ documentoRepository: repo })(1);
    expect(repo.docs[0]).toMatchObject({ tipoDte: 33, receptorRut: "77777777-7" });
  });

  it("es idempotente", async () => {
    const repo = nuevoRepo(orden(1));
    repo.envios.push(envio(1, 1, 2));
    const emitir = emitirDocumentosOrden({ documentoRepository: repo });
    await emitir(1);
    const r = await emitir(1);
    expect(r.nuevos).toBe(0);
    expect(repo.docs).toHaveLength(2);
  });

  it("rechaza ordenes no pagadas (409) e inexistentes (404)", async () => {
    const repo = nuevoRepo(orden(1, { estadoPago: "autorizado" }));
    const emitir = emitirDocumentosOrden({ documentoRepository: repo });
    expect(await codigo(emitir(1))).toBe("ORDEN_NO_PAGADA");
    expect(await codigo(emitir(99))).toBe("ORDEN_NO_ENCONTRADA");
  });

  it("folios correlativos y sin repeticion con emisiones concurrentes", async () => {
    const repo = nuevoRepo(...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => orden(i)));
    const emitir = emitirDocumentosOrden({ documentoRepository: repo });
    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((i) => emitir(i)));
    const folios = repo.docs.filter((d) => d.tipoDte === 39).map((d) => d.folio).sort((a, b) => a - b);
    expect(folios).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Misma orden en paralelo: una sola boleta.
    await Promise.all([emitir(1), emitir(1), emitir(1)]);
    expect(repo.docs.filter((d) => d.ordenId === 1 && d.tipoDte === 39)).toHaveLength(1);
  });

  it("folios independientes por tipo y emisor", async () => {
    const repo = nuevoRepo(orden(1), orden(2));
    repo.envios.push(envio(1, 1, 2), envio(2, 2, 2), envio(3, 2, 3));
    const emitir = emitirDocumentosOrden({ documentoRepository: repo });
    await emitir(1);
    await emitir(2);
    const guias = repo.docs.filter((d) => d.tipoDte === 52).map((d) => `${d.emisorRut}#${d.folio}`);
    expect(guias.sort()).toEqual(["90000002-K#1", "90000002-K#2", "90000003-K#1"]);
  });
});

describe("reembolsos", () => {
  const deps = (repo: RepoMem) => ({ documentoRepository: repo });

  it("reembolso total sin monto: nota de credito, orden reembolsada, auditoria", async () => {
    const repo = nuevoRepo(orden(1));
    const r = await crearReembolso(deps(repo))(7, 1, { motivo: "Producto danado" });
    expect(r.notaCredito).toMatchObject({ tipoDte: 61, total: 10000 });
    expect(r.saldo).toBe(0);
    expect(r.reembolsable).toBe(false);
    expect(repo.ordenes.get(1)).toMatchObject({ estadoPago: "reembolsado", estado: "reembolsada" });
    const a = repo.audit.find((x) => x.accion === "reembolsar") as RegistroAuditoria;
    expect(a).toMatchObject({ usuarioId: 7, entidad: "orden", entidadId: 1 });
    expect(a.datosDespues).toMatchObject({ motivo: "Producto danado", esTotal: true, monto: 10000 });
    expect(a.datosAntes).toMatchObject({ estadoPago: "pagado" });
  });

  it("parcial deja pagado, baja el saldo y luego el resto cierra el reembolso", async () => {
    const repo = nuevoRepo(orden(1));
    const p = await crearReembolso(deps(repo))(7, 1, { monto: 4000, motivo: "Faltante" });
    expect(p).toMatchObject({ reembolsado: 4000, saldo: 6000, reembolsable: true });
    expect(repo.ordenes.get(1)).toMatchObject({ estadoPago: "pagado", estado: "pagada" });
    const t = await crearReembolso(deps(repo))(7, 1, { motivo: "Resto" });
    expect(t.notaCredito.total).toBe(6000);
    expect(repo.ordenes.get(1)).toMatchObject({ estadoPago: "reembolsado", estado: "reembolsada" });
    expect(t.items).toHaveLength(2);
    expect(repo.docs.filter((d) => d.tipoDte === 61).map((d) => d.folio).sort()).toEqual([1, 2]);
  });

  it("409 si excede el saldo o ya esta reembolsada del todo", async () => {
    const repo = nuevoRepo(orden(1));
    await crearReembolso(deps(repo))(7, 1, { monto: 7000, motivo: "x" });
    expect(await codigo(crearReembolso(deps(repo))(7, 1, { monto: 3001, motivo: "x" }))).toBe("MONTO_EXCEDE_SALDO");
    await crearReembolso(deps(repo))(7, 1, { monto: 3000, motivo: "x" });
    expect(await codigo(crearReembolso(deps(repo))(7, 1, { motivo: "doble" }))).toBe("MONTO_EXCEDE_SALDO");
    expect(await codigo(crearReembolso(deps(repo))(7, 1, { monto: 1, motivo: "doble" }))).toBe("MONTO_EXCEDE_SALDO");
  });

  it("409 si no esta pagada, 404 si no existe, 400 si el motivo falta", async () => {
    const repo = nuevoRepo(orden(1, { estadoPago: "autorizado" }));
    expect(await codigo(crearReembolso(deps(repo))(7, 1, { motivo: "x" }))).toBe("ORDEN_NO_PAGADA");
    expect(await codigo(crearReembolso(deps(repo))(7, 9, { motivo: "x" }))).toBe("ORDEN_NO_ENCONTRADA");
    expect(await codigo(crearReembolso(deps(repo))(7, 1, { motivo: "" }))).toBe("VALIDACION");
    expect(await codigo(crearReembolso(deps(repo))(7, 1, { motivo: "x".repeat(301) }))).toBe("VALIDACION");
  });

  it("reembolsos concurrentes no exceden el total", async () => {
    const repo = nuevoRepo(orden(1));
    const res = await Promise.allSettled([1, 2, 3, 4].map(() => crearReembolso(deps(repo))(7, 1, { monto: 4000, motivo: "x" })));
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(2);
    expect(repo.docs.filter((d) => d.tipoDte === 61).reduce((t, d) => t + d.total, 0)).toBe(8000);
  });

  it("referencia el documento original y llama al punto de extension de pasarela", async () => {
    const repo = nuevoRepo(orden(1, { requiereFactura: true }));
    const llamadas: unknown[] = [];
    const r = await crearReembolso({ ...deps(repo), devolverDinero: async (s) => void llamadas.push(s) })(7, 1, { monto: 100, motivo: "x" });
    const original = repo.docs.find((d) => d.tipoDte === 33) as DocumentoTributario;
    expect((repo.audit.find((a) => a.accion === "reembolsar")?.datosDespues as { documentoOriginalId: number }).documentoOriginalId).toBe(original.id);
    expect(llamadas).toEqual([{ ordenId: 1, ordenCodigo: "CM-1", monto: 100, referenciaPasarela: "ref", notaCreditoId: r.notaCredito.id }]);
    expect(r.devolucionPasarela).toBe("ok");
    const sin = await crearReembolso(deps(repo))(7, 1, { monto: 100, motivo: "x" });
    expect(sin.devolucionPasarela).toBe("no_integrada");
  });

  it("listar y buscar por codigo", async () => {
    const repo = nuevoRepo(orden(1));
    await crearReembolso(deps(repo))(7, 1, { monto: 2500, motivo: "m1" });
    const l = await listarReembolsosOrden(deps(repo))(1);
    expect(l.items[0]).toMatchObject({ monto: 2500, motivo: "m1", pdfUrl: expect.stringContaining("/pdf") });
    const b = await buscarReembolsosPorCodigo(deps(repo))({ codigo: "cm-1" });
    expect(b.orden.id).toBe(1);
    expect(await codigo(buscarReembolsosPorCodigo(deps(repo))({ codigo: "CM-404" }))).toBe("ORDEN_NO_ENCONTRADA");
  });
});

describe("generarPdfDocumento", () => {
  it("produce un PDF valido con la leyenda de simulado", () => {
    const documento: DocumentoTributario = {
      id: 1, tipoDte: 39, folio: 12, ordenId: 1, ordenEnvioId: null, emisorRut: "76000000-0", receptorRut: "1-9",
      neto: 8403, iva: 1597, total: 10000, trackIdSii: "SIM-39-12", estadoSii: "aceptado", xmlUrl: null, pdfUrl: null, emitidoEn: new Date()
    };
    const bytes = generarPdfDocumento({
      documento, ordenCodigo: "CM-1", ordenUsuarioId: 5, proveedorId: null, emisorNombre: "Cotizapp", receptorNombre: "Ñandú (Cliente)",
      lineas: Array.from({ length: 60 }, (_, i) => ({ nombre: `Producto ${i}`, formato: "caja", cantidad: 2, precioUnitario: 1000, totalLinea: 2000 })),
      referencia: null, motivo: null
    });
    const s = Buffer.from(bytes).toString("latin1");
    expect(s.startsWith("%PDF-")).toBe(true);
    expect(s).toContain("DOCUMENTO SIMULADO - SIN VALIDEZ TRIBUTARIA");
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect((s.match(/\/Type \/Page /g) ?? []).length).toBeGreaterThan(1);
  });
});
