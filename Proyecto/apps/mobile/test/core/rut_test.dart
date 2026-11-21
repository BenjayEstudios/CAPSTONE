import 'package:cotizapp_mobile/core/format/rut.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('valida el dígito verificador (RUT del seed)', () {
    // rut(76111222) en seed.ts -> El Fogón
    final dv = digitoVerificador('76111222');
    expect(rutValido('76111222-$dv'), isTrue);
    expect(rutValido('76.111.222-$dv'), isTrue);
    expect(rutValido('76111222-${dv == '1' ? '2' : '1'}'), isFalse);
    expect(rutValido('abc'), isFalse);
  });

  test('formatea con puntos y guion', () {
    expect(formatearRut('761112225'), '76.111.222-5');
    expect(formatearRut('12345678k'), '12.345.678-K');
  });
}
