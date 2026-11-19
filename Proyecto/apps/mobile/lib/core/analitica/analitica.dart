import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../fake/fake_backend.dart';
import '../fake/fake_providers.dart';
import '../network/api_client.dart';

// Eventos analíticos del comprador (vista de ficha, búsqueda, click en una
// oferta), que alimentan las visitas y la conversión del distribuidor
// (KAN-134). POST /eventos/lote existe y es público (no exige token); el
// cuerpo va en snake_case, como eventoEntradaSchema. Nunca rompe la
// experiencia: si falla, el evento se pierde.

abstract interface class EventosDatasource {
  Future<void> enviar(List<Map<String, dynamic>> eventos);
}

class EventosRemoteDatasource implements EventosDatasource {
  const EventosRemoteDatasource(this._api);
  final ApiClient _api;

  @override
  Future<void> enviar(List<Map<String, dynamic>> eventos) => _api.post('/eventos/lote', body: {'eventos': eventos});
}

class EventosFakeDatasource implements EventosDatasource {
  const EventosFakeDatasource(this._backend);
  final FakeBackend _backend;

  @override
  Future<void> enviar(List<Map<String, dynamic>> eventos) async => _backend.registrarEventos({'eventos': eventos});
}

class Analitica {
  Analitica(this._datasource, {String? sesionId}) : sesionId = sesionId ?? _nuevaSesion();

  final EventosDatasource _datasource;
  // Una sesión por apertura de la app (8-36 caracteres alfanuméricos).
  final String sesionId;

  static String _nuevaSesion() {
    final r = Random.secure();
    return List.generate(32, (_) => r.nextInt(16).toRadixString(16)).join();
  }

  void _enviar(Map<String, dynamic> evento) {
    _datasource.enviar([
      {...evento, 'sesion_id': sesionId},
    ]).catchError((Object _) {});
  }

  // origen: catalogo | busqueda | directo
  void vistaProducto(int productoId, {required String origen}) =>
      _enviar({'tipo_evento': 'vista_producto', 'producto_id': productoId, 'origen': origen});

  void busqueda(String termino, {required int resultados}) {
    final t = termino.trim();
    if (t.isEmpty) return;
    _enviar({'tipo_evento': 'busqueda', 'termino': t, 'resultados': resultados});
  }

  // Click en una oferta del comparador (agregarla al carro).
  void clickOferta(int productoId, int ofertaId) =>
      _enviar({'tipo_evento': 'click_oferta', 'producto_id': productoId, 'oferta_id': ofertaId, 'convirtio': false});
}

final analiticaProvider = Provider<Analitica>((ref) {
  final datasource = ref.watch(appConfigProvider).usarFakes
      ? EventosFakeDatasource(ref.watch(fakeBackendProvider))
      : EventosRemoteDatasource(ref.watch(apiClientProvider));
  return Analitica(datasource);
});
