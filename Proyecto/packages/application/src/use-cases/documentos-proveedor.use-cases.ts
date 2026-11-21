import {
  subirDocumentoQuerySchema,
  TIPOS_DOCUMENTO_REQUERIDOS,
  type AlmacenArchivos,
  type ProveedorDocumento,
  type ProveedorDocumentoTipo,
  type ProveedorRepository
} from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";
import { validar } from "../validacion.js";
import { vigenciaDocumento, type EstadoDocumentoAlerta } from "./panel-proveedor.use-cases.js";
import { detectarFormatoImagen } from "./subir-imagen-producto.use-case.js";

// Documentos del proveedor (KAN-110): subir la carpeta tributaria, la
// resolucion sanitaria y el certificado de vigencia, y ver su estado. Cada
// subida queda en revision pendiente hasta que un admin la apruebe o rechace
// (PATCH /proveedores/:id/documentos/:documentoId/revision, ya existente).

export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 5 * 1024 * 1024;

export const NOMBRES_DOCUMENTO: Record<ProveedorDocumentoTipo, string> = {
  carpeta_tributaria: "Carpeta tributaria",
  resolucion_sanitaria: "Resolución sanitaria",
  vigencia: "Certificado de vigencia"
};

/**
 * La resolucion sanitaria y el certificado de vigencia vencen; la carpeta
 * tributaria es una foto de la situacion del SII y no tiene fecha de
 * vencimiento propia (supuesto del equipo, KAN-110).
 */
export const REQUIERE_VENCIMIENTO: Record<ProveedorDocumentoTipo, boolean> = {
  carpeta_tributaria: false,
  resolucion_sanitaria: true,
  vigencia: true
};

/** PDF, JPG o PNG por firma binaria (ignora el nombre y el Content-Type). */
export function detectarFormatoDocumento(b: Uint8Array): { mime: string; ext: "pdf" | "jpg" | "png" } | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { mime: "application/pdf", ext: "pdf" };
  return detectarFormatoImagen(b);
}

export interface DepsDocumentos {
  proveedorRepository: ProveedorRepository;
  almacenArchivos: AlmacenArchivos;
  generarId: () => string;
  ahora?: () => Date;
  tamanoMaximoBytes?: number;
}

const hoyIso = (deps: Pick<DepsDocumentos, "ahora">) => (deps.ahora ?? (() => new Date()))().toISOString().slice(0, 10);

function exigirProveedor(proveedorId: number) {
  if (!Number.isInteger(proveedorId) || proveedorId <= 0) throw new ErrorAplicacion(403, "FORBIDDEN", "Sin organizacion proveedora");
}

function presentar(d: ProveedorDocumento, hoy: string) {
  const v = vigenciaDocumento(d.venceEn, hoy);
  return {
    id: d.id,
    url: d.url,
    venceEn: d.venceEn,
    vigencia: v.estado,
    diasParaVencer: v.diasParaVencer,
    revisionEstado: d.revisionEstado,
    motivoRechazo: d.motivoRechazo,
    revisadoEn: d.revisadoEn
  };
}

/**
 * GET /proveedor/documentos: una fila por documento exigido con el ultimo
 * subido (el de mayor id), su vigencia calculada hoy y su revision. Sin
 * documento, estado "falta".
 */
export function misDocumentos(deps: Pick<DepsDocumentos, "proveedorRepository" | "ahora">) {
  return async (proveedorId: number) => {
    exigirProveedor(proveedorId);
    const hoy = hoyIso(deps);
    const docs = await deps.proveedorRepository.listarDocumentos(proveedorId);
    return {
      items: TIPOS_DOCUMENTO_REQUERIDOS.map((tipo) => {
        const delTipo = docs.filter((d) => d.tipo === tipo).sort((a, b) => b.id - a.id);
        const actual = delTipo[0] ? presentar(delTipo[0], hoy) : null;
        const estado: EstadoDocumentoAlerta = actual ? actual.vigencia : "falta";
        return { tipo, nombre: NOMBRES_DOCUMENTO[tipo], requiereVencimiento: REQUIERE_VENCIMIENTO[tipo], estado, actual, anteriores: Math.max(0, delTipo.length - 1) };
      })
    };
  };
}

/**
 * POST /proveedor/documentos?tipo=&venceEn= con el archivo (multipart).
 * - 400 VENCIMIENTO_REQUERIDO / DOCUMENTO_VENCIDO / FORMATO_NO_SOPORTADO / ARCHIVO_VACIO.
 * - 413 ARCHIVO_MUY_GRANDE.
 * El nombre del archivo lo genera el servidor. Si falla el registro, se borra
 * el archivo guardado.
 */
export function subirDocumento(deps: DepsDocumentos) {
  const maximo = deps.tamanoMaximoBytes ?? TAMANO_MAXIMO_DOCUMENTO_BYTES;
  return async (usuarioId: number, proveedorId: number, query: unknown, contenido: Uint8Array) => {
    exigirProveedor(proveedorId);
    const q = validar(subirDocumentoQuerySchema, query);
    const hoy = hoyIso(deps);
    if (REQUIERE_VENCIMIENTO[q.tipo] && !q.venceEn) {
      throw new ErrorAplicacion(400, "VENCIMIENTO_REQUERIDO", `Indica la fecha de vencimiento de la ${NOMBRES_DOCUMENTO[q.tipo].toLowerCase()}`);
    }
    if (q.venceEn && (Number.isNaN(Date.parse(`${q.venceEn}T00:00:00Z`)) || q.venceEn < hoy)) {
      throw new ErrorAplicacion(400, "DOCUMENTO_VENCIDO", "La fecha de vencimiento ya pasó: sube un documento vigente");
    }
    if (contenido.length === 0) throw new ErrorAplicacion(400, "ARCHIVO_VACIO", "El archivo está vacío");
    if (contenido.length > maximo) throw new ErrorAplicacion(413, "ARCHIVO_MUY_GRANDE", `El archivo supera el máximo de ${Math.round(maximo / 1024 / 1024)} MB`);
    const formato = detectarFormatoDocumento(contenido);
    if (!formato) throw new ErrorAplicacion(400, "FORMATO_NO_SOPORTADO", "Solo se aceptan archivos PDF, JPG o PNG");

    const guardado = await deps.almacenArchivos.guardar(contenido, `proveedores/${proveedorId}/documentos/${q.tipo}-${deps.generarId()}.${formato.ext}`, formato.mime);
    const venceEn = q.venceEn ?? null;
    try {
      const doc = await deps.proveedorRepository.crearDocumento(
        proveedorId,
        { tipo: q.tipo, url: guardado.url, venceEn, vigencia: vigenciaDocumento(venceEn, hoy).estado },
        {
          usuarioId,
          entidad: "proveedor_documento",
          entidadId: proveedorId,
          accion: "crear",
          datosAntes: null,
          datosDespues: { operacion: "subir_documento", tipo: q.tipo, venceEn, clave: guardado.clave }
        }
      );
      return { tipo: q.tipo, nombre: NOMBRES_DOCUMENTO[q.tipo], ...presentar(doc, hoy) };
    } catch (err) {
      await deps.almacenArchivos.eliminar(guardado.clave).catch(() => undefined);
      throw err;
    }
  };
}
