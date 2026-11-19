import 'package:cotizapp_mobile/core/fake/eventos_sinteticos.dart';
import 'package:flutter_test/flutter_test.dart';

// Huella de eventosSinteticos() de packages/infrastructure/src/db/seed/seed.ts
// sacada corriendo el original en node: si el port a Dart se desvía (o el
// seed cambia), este test lo detecta.
void main() {
  test('el port del generador produce los mismos eventos que seed.ts', () {
    final eventos = eventosSinteticos();
    expect(eventos, hasLength(1996));
    expect(eventos.where((e) => e.tipo == 'vista_producto'), hasLength(1236));
    expect(eventos.where((e) => e.tipo == 'busqueda'), hasLength(333));
    expect(eventos.where((e) => e.tipo == 'click_oferta'), hasLength(427));
    expect(eventos.fold<int>(0, (s, e) => s + e.creadoEn.millisecondsSinceEpoch ~/ 1000), 3573640127455);
    expect(eventos.fold<int>(0, (s, e) => s + e.comunaId!), 34803);

    final primero = eventos.first;
    expect(primero.creadoEn, DateTime.parse('2026-09-01T20:47:20.077Z'));
    expect((primero.tipo, primero.productoId, primero.origen, primero.comunaId), ('vista_producto', 3, 'directo', 25));
    final ultimo = eventos.last;
    expect(ultimo.creadoEn, DateTime.parse('2026-10-22T13:56:10.034Z'));
    expect((ultimo.tipo, ultimo.ofertaId, ultimo.convirtio), ('click_oferta', 24, false));
  });

  test('incluye los 6 eventos explícitos del seed', () {
    expect(eventosDelSeed(), hasLength(1996 + 6));
  });
}
