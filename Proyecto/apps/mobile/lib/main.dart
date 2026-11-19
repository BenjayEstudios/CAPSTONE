import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'core/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Nombres de meses/días en español para DateFormat (ver core/format).
  Intl.defaultLocale = 'es_CL';
  await initializeDateFormatting('es_CL');
  runApp(const ProviderScope(child: CotizappMobileApp()));
}
