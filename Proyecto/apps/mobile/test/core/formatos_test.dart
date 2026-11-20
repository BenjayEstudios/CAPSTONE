import 'package:cotizapp_mobile/core/format/formatos.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es_CL'));

  test('formatearClp usa punto de miles y sin decimales', () {
    expect(formatearClp(12490), r'$12.490');
    expect(formatearClp(1090), r'$1.090');
    expect(formatearClp(0), r'$0');
    expect(formatearClp(1250000), r'$1.250.000');
    expect(formatearClp(-4990), r'-$4.990');
  });

  test('formatearPlazo muestra horas hasta 48 y días sobre eso', () {
    expect(formatearPlazo(24), '24 h');
    expect(formatearPlazo(48), '48 h');
    expect(formatearPlazo(72), '3 días');
  });

  test('formatearFecha en español', () {
    expect(formatearFecha(DateTime(2026, 10, 6, 10, 15)), contains('oct'));
  });
}
