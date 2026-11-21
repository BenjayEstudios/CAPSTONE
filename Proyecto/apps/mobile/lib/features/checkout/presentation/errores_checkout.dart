import '../../../core/error/failure.dart';

// Mensajes para los 409/400 de POST /carro/confirmar (planificarOrden). El
// backend los manda sin tildes y pensados para desarrolladores.
String mensajeCheckout(Failure f) => switch (f.code) {
      'CARRO_VACIO' => 'Tu carro está vacío.',
      'OFERTA_NO_DISPONIBLE' => 'Algunos productos ya no están disponibles. Revisa tu carro.',
      'PRECIO_CAMBIO' => 'Algunos precios cambiaron desde que los agregaste. Revisa tu carro antes de pagar.',
      'MINIMO_COMPRA' => 'Hay productos bajo el mínimo de compra del proveedor.',
      'SIN_STOCK' => 'No queda stock suficiente para algunos productos. Ajusta las cantidades.',
      'PROVEEDOR_NO_DISPONIBLE' => 'Uno de los proveedores ya no está disponible.',
      'RETIRO_NO_DISPONIBLE' => 'Ese proveedor no permite retiro para este pedido. Elige despacho.',
      'MODALIDAD_NO_DISPONIBLE' => 'Un proveedor no despacha este pedido. Elige retiro en su bodega.',
      'DIRECCION_REQUERIDA' => 'Indica una dirección de despacho.',
      'SIN_COBERTURA' => 'Algún proveedor no despacha a esa comuna. Prueba otra dirección o retiro.',
      _ => f.message,
    };

// Errores que se arreglan en el carro (vuelve a él para ver los avisos).
bool seArreglaEnElCarro(Failure f) =>
    const ['CARRO_VACIO', 'OFERTA_NO_DISPONIBLE', 'PRECIO_CAMBIO', 'MINIMO_COMPRA', 'SIN_STOCK'].contains(f.code);
