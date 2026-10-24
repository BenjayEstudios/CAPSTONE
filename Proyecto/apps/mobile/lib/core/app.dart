import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class CotizappMobileApp extends ConsumerWidget {
  const CotizappMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Cotizapp',
      theme: appTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      // Textos de Material (selectores, tooltips, "Atrás") en español.
      locale: const Locale('es', 'CL'),
      supportedLocales: const [Locale('es', 'CL')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
    );
  }
}
