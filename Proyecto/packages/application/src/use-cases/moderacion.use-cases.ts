import {
  abrirCasoSchema,
  asignarCasoSchema,
  descartarCasoSchema,
  idParamSchema,
  listarCasosQuerySchema,
  resolverCasoSchema,
  type EventoModeracion,
  type ModeracionCaso,
  type ModeracionRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";

type Deps = { moderacionRepository: ModeracionRepository };

// auditoria_log.accion no tiene valores propios de moderacion: se usa "editar"
// (y "crear" al abrir) con datosDespues.operacion = "<operacion>_caso".
const OPERACIONES_FINALES = new Set(["resolver_caso", "descartar_caso"]);

async function exigirCaso(repo: ModeracionRepository, id: number): Promise<ModeracionCaso> {
  const caso = await repo.buscarPorId(id);
  if (!caso) throw new ErrorAplicacion(404, "CASO_NO_ENCONTRADO", "El caso de moderacion no existe");
  return caso;
}

function exigirAbierto(caso: ModeracionCaso, operacion: string) {
  if (caso.estado !== "abierto") {
    throw new ErrorAplicacion(409, "TRANSICION_INVALIDA", `No se puede ${operacion} un caso en estado ${caso.estado}`);
  }
}

export function listarCasosModeracion(deps: Deps) {
  return async (input: unknown) => {
    const f = validar(listarCasosQuerySchema, input);
    const { items, total } = await deps.moderacionRepository.listar(f);
    return { items, pagina: f.pagina, tamano: f.tamano, total, totalPaginas: Math.max(1, Math.ceil(total / f.tamano)) };
  };
}

export function obtenerCasoModeracion(deps: Deps) {
  return async (params: unknown) => {
    const { id } = validar(idParamSchema, params);
    const repo = deps.moderacionRepository;
    const caso = await exigirCaso(repo, id);
    const [historial, entidadReferenciada] = await Promise.all([
      repo.historial(id),
      repo.resolverEntidad(caso.entidad, caso.entidadId)
    ]);
    const ultimo = (pred: (e: EventoModeracion) => boolean) => [...historial].reverse().find(pred) ?? null;
    const asignacion = ultimo((e) => e.operacion === "asignar_caso");
    const cierre = ultimo((e) => OPERACIONES_FINALES.has(e.operacion));
    return {
      ...caso,
      entidadReferenciada,
      asignadoPor: asignacion?.usuario ?? null,
      cierre: cierre ? { operacion: cierre.operacion, usuario: cierre.usuario, creadoEn: cierre.creadoEn, nota: cierre.nota } : null,
      historial
    };
  };
}

export function asignarCasoModeracion(deps: Deps) {
  return async (params: unknown, input: unknown, usuarioId: number) => {
    const { id } = validar(idParamSchema, params);
    const { usuarioId: destino } = validar(asignarCasoSchema, input);
    const repo = deps.moderacionRepository;
    const caso = await exigirCaso(repo, id);
    exigirAbierto(caso, "asignar");
    if (destino !== null) {
      const internos = await repo.usuariosInternos();
      if (!internos.some((u) => u.id === destino)) {
        throw new ErrorAplicacion(400, "USUARIO_INVALIDO", "El usuario no es un usuario interno activo");
      }
    }
    const actualizado = await repo.cambiar(
      id,
      { asignadoA: destino },
      {
        usuarioId,
        entidad: "moderacion_caso",
        entidadId: id,
        accion: "editar",
        datosAntes: { estado: caso.estado, asignadoA: caso.asignadoA?.id ?? null },
        datosDespues: { operacion: "asignar_caso", estado: caso.estado, asignadoA: destino }
      }
    );
    if (!actualizado) throw new ErrorAplicacion(409, "TRANSICION_INVALIDA", "El caso ya no esta abierto");
    return actualizado;
  };
}

function cerrar(operacion: "resolver_caso" | "descartar_caso", estado: "resuelto" | "descartado", campo: "nota" | "motivo") {
  return (deps: Deps & { ahora?: () => Date }) => {
    const ahora = deps.ahora ?? (() => new Date());
    return async (params: unknown, input: unknown, usuarioId: number) => {
      const { id } = validar(idParamSchema, params);
      const dto = (campo === "nota" ? validar(resolverCasoSchema, input) : validar(descartarCasoSchema, input)) as Record<string, string>;
      const repo = deps.moderacionRepository;
      const caso = await exigirCaso(repo, id);
      exigirAbierto(caso, operacion === "resolver_caso" ? "resolver" : "descartar");
      const actualizado = await repo.cambiar(
        id,
        { estado, resueltoEn: ahora() },
        {
          usuarioId,
          entidad: "moderacion_caso",
          entidadId: id,
          accion: "editar",
          datosAntes: { estado: caso.estado, asignadoA: caso.asignadoA?.id ?? null },
          datosDespues: { operacion, estado, [campo]: dto[campo] }
        }
      );
      if (!actualizado) throw new ErrorAplicacion(409, "TRANSICION_INVALIDA", "El caso ya no esta abierto");
      return actualizado;
    };
  };
}

export const resolverCasoModeracion = cerrar("resolver_caso", "resuelto", "nota");
export const descartarCasoModeracion = cerrar("descartar_caso", "descartado", "motivo");

export function listarUsuariosInternosModeracion(deps: Deps) {
  return async () => ({ items: await deps.moderacionRepository.usuariosInternos() });
}

/**
 * Caso de uso reutilizable para que otros modulos (alta de proveedor, precio
 * fuera de rango, reembolso, fichas duplicadas) encolen un caso. No duplica:
 * si ya hay uno ABIERTO del mismo tipo+entidad+entidadId lo devuelve con
 * `creado: false`. `usuarioId` es opcional (null = accion del sistema).
 */
export function abrirCasoModeracion(deps: Deps) {
  return async (
    tipo: ModeracionCaso["tipo"],
    entidad: string,
    entidadId: number,
    descripcion?: string,
    usuarioId: number | null = null
  ): Promise<{ caso: ModeracionCaso; creado: boolean }> => {
    const dto = validar(abrirCasoSchema, { tipo, entidad, entidadId, descripcion });
    const repo = deps.moderacionRepository;
    const existente = await repo.buscarAbierto(dto.tipo, dto.entidad, dto.entidadId);
    if (existente) return { caso: existente, creado: false };
    const caso = await repo.crear(
      { tipo: dto.tipo, entidad: dto.entidad, entidadId: dto.entidadId, detalle: dto.descripcion ?? null },
      (casoId) => ({
        usuarioId,
        entidad: "moderacion_caso",
        entidadId: casoId,
        accion: "crear",
        datosAntes: null,
        datosDespues: {
          operacion: "abrir_caso",
          tipo: dto.tipo,
          estado: "abierto",
          entidadReferenciada: dto.entidad,
          entidadReferenciadaId: dto.entidadId
        }
      })
    );
    return { caso, creado: true };
  };
}
