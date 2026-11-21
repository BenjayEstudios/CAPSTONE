import type { OrdenRepository, ProveedorRepository, ServicioCorreo, UsuarioRepository } from "@cotizapp/domain";
import { enviarConfirmacionCompra, enviarNuevaOrdenProveedor } from "./correos.js";

// KAN-156. Correos que dispara un pago aprobado: confirmacion de compra al
// comprador (con el folio) y aviso de nueva orden a cada proveedor con envio.
// Cada envio es independiente: si uno falla se registra y se sigue con el
// resto. Nunca lanza, porque el pago ya quedo confirmado.

interface Deps {
  ordenRepository: OrdenRepository;
  usuarioRepository: UsuarioRepository;
  proveedorRepository: Pick<ProveedorRepository, "perfil">;
  servicioCorreo: ServicioCorreo;
  /** URL del panel del proveedor donde revisar la orden (opcional). */
  urlPanelProveedor?: string;
  log?: (mensaje: string, error?: unknown) => void;
}

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

export function notificarOrdenPagada(deps: Deps) {
  return async (ordenId: number): Promise<{ enviados: number; fallidos: number }> => {
    let enviados = 0;
    let fallidos = 0;
    const intentar = async (descripcion: string, envio: () => Promise<void>) => {
      try {
        await envio();
        enviados++;
      } catch (err) {
        fallidos++;
        deps.log?.(`No se pudo enviar el correo (${descripcion}) de la orden ${ordenId}`, err);
      }
    };

    const oc = await deps.ordenRepository.buscarPorId(ordenId, { tipo: "todas" });
    if (!oc) return { enviados, fallidos };
    const { orden } = oc;

    const comprador = await deps.usuarioRepository.buscarPorId(orden.usuarioId);
    if (comprador) {
      await intentar("confirmacion de compra", () =>
        enviarConfirmacionCompra(deps.servicioCorreo, {
          para: comprador.usuario.email,
          nombre: comprador.usuario.nombre,
          folio: orden.codigo,
          total: clp(orden.total)
        })
      );
    }

    for (const envio of oc.envios) {
      const perfil = await deps.proveedorRepository.perfil(envio.proveedorId).catch(() => null);
      if (!perfil?.emailContacto) continue;
      await intentar(`aviso al proveedor ${envio.proveedorId}`, () =>
        enviarNuevaOrdenProveedor(deps.servicioCorreo, {
          para: perfil.emailContacto as string,
          nombreProveedor: perfil.nombreFantasia ?? perfil.razonSocial,
          folio: orden.codigo,
          urlOrden: deps.urlPanelProveedor
        })
      );
    }
    return { enviados, fallidos };
  };
}
