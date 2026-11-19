import type { ProveedorRepository } from "@cotizapp/domain";
import { documentosFaltantes, exigirProveedor } from "./proveedor-reglas.js";

export function obtenerProveedor(deps: { proveedorRepository: ProveedorRepository }) {
  return async (id: number) => {
    const p = await exigirProveedor(deps.proveedorRepository, id);
    const documentos = await deps.proveedorRepository.listarDocumentos(id);
    const faltantes = documentosFaltantes(documentos);
    return {
      id: p.id,
      razonSocial: p.razonSocial,
      nombreFantasia: p.nombreFantasia,
      rut: p.rut,
      giro: p.giro,
      emailContacto: p.emailContacto,
      telefono: p.telefono,
      estado: p.estado,
      comisionPct: p.comisionPct,
      banco: p.banco,
      cuentaBancaria: p.cuentaBancaria,
      creadaEn: p.creadaEn,
      documentos,
      requisitos: { documentosFaltantes: faltantes, puedeAprobar: faltantes.length === 0 }
    };
  };
}
