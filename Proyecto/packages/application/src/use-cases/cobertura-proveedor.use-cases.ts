import {
  cambiosPuntoRetiroSchema,
  cambiosZonaSchema,
  nuevaZonaSchema,
  nuevoPuntoRetiroSchema,
  type CambiosPuntoRetiro,
  type ComunaRepository,
  type ProveedorRepository,
  type RegistroAuditoria
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

// Cobertura de despacho y puntos de retiro del proveedor (KAN-109). La
// organizacion sale del token; una zona o un punto de otro proveedor responde
// 404, igual que uno que no existe.

export interface DepsCobertura {
  proveedorRepository: ProveedorRepository;
  comunaRepository: ComunaRepository;
}

function exigirProveedor(proveedorId: number) {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) throw new ErrorAplicacion(403, "FORBIDDEN", "Sin organizacion proveedora");
}

const auditoria = (usuarioId: number, entidad: string, entidadId: number, accion: RegistroAuditoria["accion"], antes: unknown, despues: unknown): RegistroAuditoria => ({
  usuarioId,
  entidad,
  entidadId,
  accion,
  datosAntes: antes,
  datosDespues: despues
});

/** GET /proveedor/cobertura/regiones: regiones y comunas para elegir una zona. */
export function regionesParaCobertura(deps: Pick<DepsCobertura, "comunaRepository">) {
  return async () => {
    const regiones: Array<{ codigo: string; nombre: string; comunas: Array<{ id: number; nombre: string }> }> = [];
    for (const c of await deps.comunaRepository.listar()) {
      const r = regiones.find((x) => x.codigo === c.regionCodigo);
      if (r) r.comunas.push({ id: c.id, nombre: c.nombre });
      else regiones.push({ codigo: c.regionCodigo, nombre: c.regionNombre, comunas: [{ id: c.id, nombre: c.nombre }] });
    }
    return regiones;
  };
}

/**
 * POST /proveedor/cobertura/zonas. Con comunaId la region sale de la comuna;
 * sin ella, la zona es toda la region. 409 ZONA_DUPLICADA si ya hay una zona
 * para esa comuna o para toda esa region (el UNIQUE de MySQL no lo ataja:
 * con comuna_id NULL dos filas no chocan).
 */
export function crearZona(deps: DepsCobertura) {
  return async (usuarioId: number, proveedorId: number, input: unknown) => {
    exigirProveedor(proveedorId);
    const dto = validar(nuevaZonaSchema, input);
    const comunas = await deps.comunaRepository.listar();
    let regionCodigo: string;
    let comunaId: number | null = null;
    if (dto.comunaId) {
      const c = comunas.find((x) => x.id === dto.comunaId);
      if (!c) throw new ErrorAplicacion(400, "VALIDACION", "comunaId: la comuna no existe");
      comunaId = c.id;
      regionCodigo = c.regionCodigo;
    } else {
      if (!comunas.some((x) => x.regionCodigo === dto.regionCodigo)) throw new ErrorAplicacion(400, "VALIDACION", "regionCodigo: la region no existe");
      regionCodigo = dto.regionCodigo!;
    }
    const { zonas } = await deps.proveedorRepository.cobertura(proveedorId);
    if (zonas.some((z) => z.comunaId === comunaId && z.regionCodigo === regionCodigo)) {
      throw new ErrorAplicacion(409, "ZONA_DUPLICADA", comunaId ? "Ya despachas a esa comuna: edita su costo o plazo" : "Ya despachas a toda esa region: edita su costo o plazo");
    }
    const zona = { comunaId, regionCodigo, costoDespacho: dto.costoDespacho, plazoHoras: dto.plazoHoras ?? null };
    const id = await deps.proveedorRepository.crearZona(proveedorId, zona, auditoria(usuarioId, "proveedor_cobertura", proveedorId, "crear", null, { operacion: "crear_zona", ...zona }));
    return { id };
  };
}

/** PATCH /proveedor/cobertura/zonas/:id: costo y plazo (la ubicacion no cambia; para eso se borra y se crea). */
export function actualizarZona(deps: DepsCobertura) {
  return async (usuarioId: number, proveedorId: number, id: number, input: unknown) => {
    exigirProveedor(proveedorId);
    const dto = validar(cambiosZonaSchema, input);
    const zona = (await deps.proveedorRepository.cobertura(proveedorId)).zonas.find((z) => z.id === id);
    if (!zona) throw new ErrorAplicacion(404, "ZONA_NO_ENCONTRADA", "Zona no encontrada");
    const antes = { costoDespacho: zona.costoDespacho, plazoHoras: zona.plazoHoras };
    await deps.proveedorRepository.actualizarZona(proveedorId, id, dto, auditoria(usuarioId, "proveedor_cobertura", id, "editar", antes, { operacion: "editar_zona", ...dto }));
    return { ...zona, ...dto };
  };
}

/** DELETE /proveedor/cobertura/zonas/:id */
export function eliminarZona(deps: DepsCobertura) {
  return async (usuarioId: number, proveedorId: number, id: number): Promise<void> => {
    exigirProveedor(proveedorId);
    const zona = (await deps.proveedorRepository.cobertura(proveedorId)).zonas.find((z) => z.id === id);
    if (!zona) throw new ErrorAplicacion(404, "ZONA_NO_ENCONTRADA", "Zona no encontrada");
    await deps.proveedorRepository.eliminarZona(proveedorId, id, auditoria(usuarioId, "proveedor_cobertura", id, "eliminar", zona, { operacion: "eliminar_zona" }));
  };
}

/** GET /proveedor/puntos-retiro */
export function misPuntosRetiro(deps: Pick<DepsCobertura, "proveedorRepository">) {
  return async (proveedorId: number) => {
    exigirProveedor(proveedorId);
    return { items: await deps.proveedorRepository.puntosRetiro(proveedorId) };
  };
}

async function comunaExiste(deps: DepsCobertura, comunaId: number | undefined) {
  if (comunaId === undefined) return;
  if (!(await deps.comunaRepository.listar()).some((c) => c.id === comunaId)) throw new ErrorAplicacion(400, "VALIDACION", "comunaId: la comuna no existe");
}

const sinNulos = (d: { calle: string; numero?: string | null; complemento?: string | null; comunaId: number }) => ({
  calle: d.calle,
  numero: d.numero ?? null,
  complemento: d.complemento ?? null,
  comunaId: d.comunaId
});

/** POST /proveedor/puntos-retiro */
export function crearPuntoRetiro(deps: DepsCobertura) {
  return async (usuarioId: number, proveedorId: number, input: unknown) => {
    exigirProveedor(proveedorId);
    const dto = validar(nuevoPuntoRetiroSchema, input);
    await comunaExiste(deps, dto.direccion.comunaId);
    const punto = { nombre: dto.nombre, horario: dto.horario ?? null, activo: dto.activo ?? true, direccion: sinNulos(dto.direccion) };
    const id = await deps.proveedorRepository.crearPuntoRetiro(proveedorId, punto, auditoria(usuarioId, "punto_retiro", proveedorId, "crear", null, { operacion: "crear_punto_retiro", ...punto }));
    return { id };
  };
}

/**
 * Si el proveedor ofrece retiro, no puede quedar sin puntos activos: el
 * checkout no tendria donde ofrecerlo. 409 ULTIMO_PUNTO_RETIRO.
 */
async function exigirOtroActivo(deps: DepsCobertura, proveedorId: number, id: number) {
  const [puntos, cobertura] = await Promise.all([deps.proveedorRepository.puntosRetiro(proveedorId), deps.proveedorRepository.cobertura(proveedorId)]);
  if (cobertura.ofreceRetiro && !puntos.some((p) => p.activo && p.id !== id)) {
    throw new ErrorAplicacion(409, "ULTIMO_PUNTO_RETIRO", "Es tu único punto de retiro activo. Agrega otro o, en tu perfil, pasa a solo despacho.");
  }
}

/** PATCH /proveedor/puntos-retiro/:id: nombre, horario, direccion (nueva fila) o activo. */
export function actualizarPuntoRetiro(deps: DepsCobertura) {
  return async (usuarioId: number, proveedorId: number, id: number, input: unknown) => {
    exigirProveedor(proveedorId);
    const dto = validar(cambiosPuntoRetiroSchema, input);
    const punto = (await deps.proveedorRepository.puntosRetiro(proveedorId)).find((p) => p.id === id);
    if (!punto) throw new ErrorAplicacion(404, "PUNTO_NO_ENCONTRADO", "Punto de retiro no encontrado");
    if (dto.activo === false && punto.activo) await exigirOtroActivo(deps, proveedorId, id);
    await comunaExiste(deps, dto.direccion?.comunaId);
    const { direccion, ...resto } = dto;
    const cambios: CambiosPuntoRetiro = { ...resto, ...(direccion ? { direccion: sinNulos(direccion) } : {}) };
    await deps.proveedorRepository.actualizarPuntoRetiro(
      proveedorId,
      id,
      cambios,
      auditoria(usuarioId, "punto_retiro", id, "editar", { nombre: punto.nombre, horario: punto.horario, activo: punto.activo, direccion: punto.direccion }, { operacion: "editar_punto_retiro", ...cambios })
    );
    return (await deps.proveedorRepository.puntosRetiro(proveedorId)).find((p) => p.id === id)!;
  };
}

/** DELETE /proveedor/puntos-retiro/:id: solo si ningun envio lo cita (409 PUNTO_USADO: se desactiva). */
export function eliminarPuntoRetiro(deps: DepsCobertura) {
  return async (usuarioId: number, proveedorId: number, id: number): Promise<void> => {
    exigirProveedor(proveedorId);
    const punto = (await deps.proveedorRepository.puntosRetiro(proveedorId)).find((p) => p.id === id);
    if (!punto) throw new ErrorAplicacion(404, "PUNTO_NO_ENCONTRADO", "Punto de retiro no encontrado");
    if (punto.usado) throw new ErrorAplicacion(409, "PUNTO_USADO", "Ya hubo retiros en este punto: desactívalo en vez de borrarlo");
    if (punto.activo) await exigirOtroActivo(deps, proveedorId, id);
    await deps.proveedorRepository.eliminarPuntoRetiro(proveedorId, id, auditoria(usuarioId, "punto_retiro", id, "eliminar", punto, { operacion: "eliminar_punto_retiro" }));
  };
}
