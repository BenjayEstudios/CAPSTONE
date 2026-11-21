import 'seed.dart';
import 'seed_operacion.dart';

// Eventos analíticos del seed: los 6 explícitos más el tráfico sintético
// de eventosSinteticos() en seed.ts (1 sep - 22 oct 2026). El generador es
// un port exacto del de seed.ts (misma semilla y mismo orden de llamadas),
// así que el fake tiene los mismos eventos que la base del equipo; el test
// eventos_sinteticos_test.dart lo verifica contra el resultado de node.

typedef EventoSeed = ({
  String tipo, // vista_producto | click_oferta | busqueda
  DateTime creadoEn,
  int? productoId,
  int? ofertaId,
  int? comunaId,
  String? origen,
  bool? convirtio,
  String? termino,
  int? resultados,
});

// mulberry32 de seed.ts, con la aritmética de 32 bits de JS.
double Function() generador(int semilla) {
  var a = semilla;
  int imul(int x, int y) => (x * y).toSigned(32);
  return () {
    a = (a + 0x6d2b79f5).toSigned(32);
    var t = imul(a ^ (a.toUnsigned(32) >> 15), 1 | a);
    t = (t + imul(t ^ (t.toUnsigned(32) >> 7), 61 | t)).toSigned(32) ^ t;
    return (t ^ (t.toUnsigned(32) >> 14)).toUnsigned(32) / 4294967296;
  };
}

const _hora = Duration(hours: 1);

List<EventoSeed> eventosDelSeed() {
  final fogon = seedComunaId('13120');
  final anonima = seedComunaId('13114');
  EventoSeed e(String tipo, String fecha, int? comuna,
          {int? productoId, int? ofertaId, String? origen, bool? convirtio, String? termino, int? resultados}) =>
      (
        tipo: tipo,
        creadoEn: DateTime.parse('$fecha-03:00'),
        productoId: productoId,
        ofertaId: ofertaId,
        comunaId: comuna,
        origen: origen,
        convirtio: convirtio,
        termino: termino,
        resultados: resultados,
      );

  return [
    e('busqueda', '2026-10-06T10:02:00', fogon, termino: 'aceite', resultados: 2),
    e('vista_producto', '2026-10-06T10:03:00', fogon, productoId: 1, origen: 'busqueda'),
    e('click_oferta', '2026-10-06T10:05:00', fogon, productoId: 1, ofertaId: seedOfertaDe(1, 2).id, convirtio: true),
    e('vista_producto', '2026-10-08T15:20:00', anonima, productoId: 5, origen: 'catalogo'),
    e('click_oferta', '2026-10-08T15:21:00', anonima, productoId: 5, ofertaId: seedOfertaDe(5, 3).id, convirtio: false),
    e('busqueda', '2026-10-09T09:40:00', null, termino: 'harina integral', resultados: 0),
    ...eventosSinteticos(),
  ];
}

List<EventoSeed> eventosSinteticos() {
  final azar = generador(20261023);
  T elegir<T>(List<T> xs) => xs[(azar() * xs.length).floor()];
  // El uuid no se guarda, pero consume 30 números del generador.
  void uuid() {
    for (var i = 0; i < 30; i++) {
      azar();
    }
  }

  const populares = [1, 3, 9, 11, 13];
  final comunas = ['13101', '13114', '13119', '13120', '13123', '13125', '13110', '13201'].map(seedComunaId).toList();
  const busquedas = [
    ('aceite', 2),
    ('arroz', 1),
    ('queso', 2),
    ('pollo', 1),
    ('leche', 1),
    ('huevos', 1),
    ('palta', 1),
    ('harina integral', 0),
    ('leche sin lactosa', 0),
    ('levadura', 0),
    ('mantequilla', 0),
  ];
  final publicadas = seedOfertas.where((o) => o.estado == 'publicada').toList();

  final eventos = <EventoSeed>[];
  for (var dia = DateTime.utc(2026, 9, 1);
      dia.isBefore(DateTime.utc(2026, 10, 23));
      dia = dia.add(const Duration(days: 1))) {
    final finDeSemana = dia.weekday == DateTime.saturday || dia.weekday == DateTime.sunday;
    final sesiones = (finDeSemana ? 6 : 14) + (azar() * 6).floor();
    for (var n = 0; n < sesiones; n++) {
      // t en milisegundos con decimales, como en JS; Date lo trunca.
      var t = dia.millisecondsSinceEpoch + (11 + azar() * 12) * _hora.inMilliseconds;
      uuid();
      if (azar() < 0.2) elegir(const [8, 9]); // usuarioId (no se usa en las estadísticas)
      final comunaId = elegir(comunas);

      void evento(String tipo,
          {int? productoId, int? ofertaId, String? origen, bool? convirtio, String? termino, int? resultados}) {
        t += (1 + azar() * 4) * 60 * 1000;
        eventos.add((
          tipo: tipo,
          creadoEn: DateTime.fromMillisecondsSinceEpoch(t.truncate(), isUtc: true),
          productoId: productoId,
          ofertaId: ofertaId,
          comunaId: comunaId,
          origen: origen,
          convirtio: convirtio,
          termino: termino,
          resultados: resultados,
        ));
      }

      final busco = azar() < 0.4;
      if (busco) {
        final (termino, resultados) = elegir(busquedas);
        evento('busqueda', termino: termino, resultados: resultados);
        if (resultados == 0) continue;
      }
      final vistas = 1 + (azar() * 3).floor();
      for (var v = 0; v < vistas; v++) {
        final productoId = azar() < 0.55 ? elegir(populares) : 1 + (azar() * seedProductos.length).floor();
        evento('vista_producto',
            productoId: productoId,
            origen: busco && v == 0 ? 'busqueda' : elegir(const ['catalogo', 'catalogo', 'directo']));

        final delProducto = publicadas.where((o) => o.productoId == productoId).toList()
          ..sort((a, b) => a.precioUnitario.compareTo(b.precioUnitario));
        if (delProducto.isEmpty || azar() >= 0.35) continue;
        final oferta = azar() < 0.6 ? delProducto.first : elegir(delProducto);
        evento('click_oferta', productoId: productoId, ofertaId: oferta.id, convirtio: azar() < 0.2);
      }
    }
  }
  return eventos;
}
