import type { CorreoSaliente } from "@cotizapp/domain";

// Plantillas de correo transaccional (texto plano, espanol). Funciones puras:
// devuelven el CorreoSaliente; el envio lo hace ServicioCorreo.
const FIRMA = "\n\n-- Equipo Cotizapp";

export function plantillaInvitacionUsuario(d: { para: string; nombre: string; claveTemporal: string; urlPanel: string }): CorreoSaliente {
  return {
    para: d.para,
    asunto: "Te invitaron a Cotizapp",
    texto:
      `Hola ${d.nombre},\n\nSe creo una cuenta para ti en el panel de Cotizapp.\n\n` +
      `Ingresa en: ${d.urlPanel}\nUsuario: ${d.para}\nClave temporal: ${d.claveTemporal}\n\n` +
      `Por seguridad, no compartas esta clave y eliminala de tu correo despues de ingresar.${FIRMA}`
  };
}

export function plantillaNuevaOrdenProveedor(d: { para: string; nombreProveedor: string; folio: string; urlOrden?: string }): CorreoSaliente {
  return {
    para: d.para,
    asunto: `Nueva orden ${d.folio}`,
    texto:
      `Hola ${d.nombreProveedor},\n\nRecibiste una nueva orden (folio ${d.folio}).` +
      (d.urlOrden ? `\nRevisala en: ${d.urlOrden}` : "") +
      FIRMA
  };
}

export function plantillaConfirmacionCompra(d: { para: string; nombre: string; folio: string; total?: string }): CorreoSaliente {
  return {
    para: d.para,
    asunto: `Confirmacion de compra ${d.folio}`,
    texto:
      `Hola ${d.nombre},\n\nTu compra fue confirmada. Folio: ${d.folio}.` +
      (d.total ? `\nTotal: ${d.total}` : "") +
      `\n\nGracias por comprar en Cotizapp.${FIRMA}`
  };
}

export function plantillaRecuperacionContrasena(d: { para: string; nombre: string; urlRecuperacion: string }): CorreoSaliente {
  return {
    para: d.para,
    asunto: "Recupera tu contrasena de Cotizapp",
    texto:
      `Hola ${d.nombre},\n\nPara definir una nueva contrasena ingresa en: ${d.urlRecuperacion}\n` +
      `Si no lo solicitaste, ignora este mensaje.${FIRMA}`
  };
}

// Funciones de envio (aun sin disparador: las usaran las historias de ordenes).
import type { ServicioCorreo } from "@cotizapp/domain";

export const enviarNuevaOrdenProveedor = (c: ServicioCorreo, d: Parameters<typeof plantillaNuevaOrdenProveedor>[0]) =>
  c.enviar(plantillaNuevaOrdenProveedor(d));
export const enviarConfirmacionCompra = (c: ServicioCorreo, d: Parameters<typeof plantillaConfirmacionCompra>[0]) =>
  c.enviar(plantillaConfirmacionCompra(d));
export const enviarRecuperacionContrasena = (c: ServicioCorreo, d: Parameters<typeof plantillaRecuperacionContrasena>[0]) =>
  c.enviar(plantillaRecuperacionContrasena(d));

export function plantillaCodigoVerificacion(d: { para: string; nombre: string; codigo: string; minutosValidez: number }): CorreoSaliente {
  return {
    para: d.para,
    asunto: "Tu codigo de verificacion de Cotizapp",
    texto:
      `Hola ${d.nombre},\n\nTu codigo de verificacion es: ${d.codigo}\n\n` +
      `Vence en ${d.minutosValidez} minutos. Si no intentaste ingresar, ignora este mensaje y cambia tu clave.${FIRMA}`
  };
}
