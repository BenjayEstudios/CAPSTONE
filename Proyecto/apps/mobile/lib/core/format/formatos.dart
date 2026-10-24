import 'package:intl/intl.dart';

// Formatos de presentación compartidos. Los montos vienen del backend como
// enteros en CLP (sin decimales), igual que en el schema (int unsigned).

// NumberFormat.currency('es_CL') deja el símbolo al final ("12.490 $"); en
// Chile se escribe adelante, así que se arma a mano sobre el separador de miles.
final _miles = NumberFormat.decimalPattern('es_CL');
final _fecha = DateFormat('d MMM yyyy', 'es_CL');
final _fechaHora = DateFormat('d MMM yyyy, HH:mm', 'es_CL');

// 12490 -> "$12.490"
String formatearClp(int monto) => '${monto < 0 ? '-' : ''}\$${_miles.format(monto.abs())}';

// 24 -> "24 h"; 72 -> "3 días" (el comparador muestra el plazo en horas
// hasta 48, como el mockup).
String formatearPlazo(int horas) {
  if (horas <= 48) return '$horas h';
  final dias = (horas / 24).ceil();
  return '$dias días';
}

// Requieren initializeDateFormatting('es_CL') (se llama en main.dart).
String formatearFecha(DateTime fecha) => _fecha.format(fecha.toLocal());
String formatearFechaHora(DateTime fecha) => _fechaHora.format(fecha.toLocal());
