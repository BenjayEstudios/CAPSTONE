// RUT chileno: dígito verificador módulo 11 (mismo cálculo que rut() en
// packages/infrastructure/src/db/seed/seed.ts).

String _limpiar(String rut) => rut.replaceAll(RegExp(r'[^0-9kK]'), '').toUpperCase();

String digitoVerificador(String cuerpo) {
  var suma = 0;
  var factor = 2;
  for (final d in cuerpo.split('').reversed) {
    suma += int.parse(d) * factor;
    factor = factor == 7 ? 2 : factor + 1;
  }
  final dv = 11 - (suma % 11);
  return dv == 11 ? '0' : (dv == 10 ? 'K' : '$dv');
}

bool rutValido(String rut) {
  final limpio = _limpiar(rut);
  if (limpio.length < 8 || limpio.length > 9) return false;
  final cuerpo = limpio.substring(0, limpio.length - 1);
  if (!RegExp(r'^\d+$').hasMatch(cuerpo)) return false;
  return digitoVerificador(cuerpo) == limpio.substring(limpio.length - 1);
}

// "761112225" -> "76.111.222-5"
String formatearRut(String rut) {
  final limpio = _limpiar(rut);
  if (limpio.length < 2) return rut;
  final cuerpo = limpio.substring(0, limpio.length - 1);
  final dv = limpio.substring(limpio.length - 1);
  final conPuntos = cuerpo.replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]}.');
  return '$conPuntos-$dv';
}
