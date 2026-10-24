import { imageSize } from "image-size";
import { ANCHO_MINIMO_IMAGEN, type AlmacenArchivos, type ProductoRepository } from "@cotizapp/domain";
import { ErrorAplicacion } from "../errors.js";

export const TAMANO_MAXIMO_IMAGEN_BYTES = 5 * 1024 * 1024;

export interface ImagenSubidaDto {
  url: string;
  clave: string;
  ancho: number;
  alto: number;
}

// Tipo real por firma binaria (magic bytes); ignora Content-Type y extension.
export function detectarFormatoImagen(b: Uint8Array): { mime: "image/jpeg" | "image/png"; ext: "jpg" | "png" } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length >= 8 && png.every((v, i) => b[i] === v)) return { mime: "image/png", ext: "png" };
  return null;
}

// Sube el archivo al almacen pero NO registra la imagen en el producto: el
// cliente usa luego PUT /productos/:id/imagenes con {url, ancho, alto}.
// El nombre del archivo lo genera el servidor (generarId), nunca el cliente.
export function subirImagenProducto(deps: {
  productoRepository: ProductoRepository;
  almacenArchivos: AlmacenArchivos;
  generarId: () => string;
  tamanoMaximoBytes?: number;
}) {
  const maximo = deps.tamanoMaximoBytes ?? TAMANO_MAXIMO_IMAGEN_BYTES;
  return async (productoId: number, contenido: Uint8Array): Promise<ImagenSubidaDto> => {
    if (contenido.length === 0) throw new ErrorAplicacion(400, "ARCHIVO_VACIO", "El archivo esta vacio");
    if (contenido.length > maximo) {
      throw new ErrorAplicacion(413, "ARCHIVO_MUY_GRANDE", `El archivo supera el maximo de ${Math.round(maximo / 1024 / 1024)} MB`);
    }
    const formato = detectarFormatoImagen(contenido);
    if (!formato) throw new ErrorAplicacion(400, "FORMATO_NO_SOPORTADO", "Solo se aceptan imagenes JPG o PNG");

    let dim: { width?: number; height?: number };
    try {
      dim = imageSize(contenido);
    } catch {
      throw new ErrorAplicacion(400, "IMAGEN_INVALIDA", "No se pudo leer la imagen");
    }
    if (!dim.width || !dim.height) throw new ErrorAplicacion(400, "IMAGEN_INVALIDA", "No se pudo leer la imagen");
    if (dim.width < ANCHO_MINIMO_IMAGEN) {
      throw new ErrorAplicacion(400, "IMAGEN_MUY_PEQUENA", `El ancho minimo es ${ANCHO_MINIMO_IMAGEN}px (recibido ${dim.width}px)`);
    }

    const producto = await deps.productoRepository.buscarPorId(productoId);
    if (!producto) throw new ErrorAplicacion(404, "PRODUCTO_NO_ENCONTRADO", "El producto no existe");

    const guardado = await deps.almacenArchivos.guardar(
      contenido,
      `productos/${productoId}/${deps.generarId()}.${formato.ext}`,
      formato.mime
    );
    return { url: guardado.url, clave: guardado.clave, ancho: dim.width, alto: dim.height };
  };
}
