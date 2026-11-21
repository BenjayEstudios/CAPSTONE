class Comuna {
  const Comuna({required this.id, required this.nombre, required this.regionNombre});

  final int id;
  final String nombre;
  final String regionNombre;
}

// Dirección guardada de la organización (GET /carro/opciones-entrega).
class DireccionEntrega {
  const DireccionEntrega({
    required this.id,
    required this.calle,
    this.numero,
    this.complemento,
    this.referencia,
    required this.comunaId,
    required this.comuna,
  });

  final int id;
  final String calle;
  final String? numero;
  final String? complemento;
  final String? referencia;
  final int comunaId;
  final String comuna;

  String get texto => [
        [calle, if (numero != null) numero!].join(' '),
        if (complemento != null) complemento!,
        comuna,
      ].join(', ');
}

class PuntoRetiro {
  const PuntoRetiro({
    required this.id,
    required this.proveedorId,
    required this.nombre,
    required this.direccion,
    this.horario,
  });

  final int id;
  final int proveedorId;
  final String nombre;
  final String direccion;
  final String? horario;
}

class OpcionesEntrega {
  const OpcionesEntrega({required this.direcciones, required this.puntosRetiro});

  final List<DireccionEntrega> direcciones;
  final List<PuntoRetiro> puntosRetiro;

  List<PuntoRetiro> puntosDe(int proveedorId) => puntosRetiro.where((p) => p.proveedorId == proveedorId).toList();
}

// Dirección escrita en el checkout (direccionNuevaSchema de carro.dto.ts).
class DireccionNueva {
  const DireccionNueva({required this.comunaId, required this.calle, this.numero, this.complemento, this.referencia});

  final int comunaId;
  final String calle;
  final String? numero;
  final String? complemento;
  final String? referencia;

  Map<String, dynamic> toJson() => {
        'comunaId': comunaId,
        'calle': calle.trim(),
        if (numero?.trim().isNotEmpty ?? false) 'numero': numero!.trim(),
        if (complemento?.trim().isNotEmpty ?? false) 'complemento': complemento!.trim(),
        if (referencia?.trim().isNotEmpty ?? false) 'referencia': referencia!.trim(),
      };
}

// Lo que se manda a POST /carro/confirmar (confirmarCarroSchema). Nombre,
// RUT y correo del comprador no son parte del body real: la factura sale de
// los datos de la organización; la app los pide para mostrarlos y validar.
class PedidoCheckout {
  const PedidoCheckout({
    this.direccionId,
    this.direccionNueva,
    this.retiros = const {},
    this.requiereFactura = false,
  });

  final int? direccionId;
  final DireccionNueva? direccionNueva;
  // proveedorId -> puntoRetiroId de los envíos que se retiran.
  final Map<int, int> retiros;
  final bool requiereFactura;

  Map<String, dynamic> toJson() => {
        if (direccionId != null) 'direccionId': direccionId,
        if (direccionNueva != null) 'direccion': direccionNueva!.toJson(),
        'retiros': [
          for (final MapEntry(key: proveedorId, value: puntoRetiroId) in retiros.entries)
            {'proveedorId': proveedorId, 'puntoRetiroId': puntoRetiroId},
        ],
        'requiereFactura': requiereFactura,
      };
}

// Respuesta 201 de POST /carro/confirmar.
class OrdenCreada {
  const OrdenCreada({
    required this.ordenId,
    required this.codigo,
    required this.subtotal,
    required this.costoDespachoTotal,
    required this.total,
  });

  final int ordenId;
  final String codigo;
  final int subtotal;
  final int costoDespachoTotal;
  final int total;
}

// Respuesta de POST /ordenes/:id/pago: adónde mandar al usuario a pagar.
class InicioPago {
  const InicioPago({required this.ordenId, required this.urlPago});

  final int ordenId;
  final String urlPago;

  // El fake no tiene pasarela externa: la simula una pantalla de la app.
  bool get esSimulado => urlPago.startsWith('fake://');
}
