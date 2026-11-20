import 'package:flutter/material.dart';

// Paleta de marca. Cian, magenta y amarillo vienen de los tokens --color-*
// de Mockups/CompraMejor ClienteMovil.html (estética CMYK); la tinta oscura
// es el fondo de login y splash. Magenta es la acción principal.
abstract final class AppColors {
  static const tinta = Color(0xFF1E1B3A);
  static const tintaClara = Color(0xFF2C2852);
  static const fondo = Color(0xFFF6F5F8);
  static const superficie = Color(0xFFEDEBF2);
  static const texto = Color(0xFF201E1D);
  static const textoSuave = Color(0xFF6B6878);
  static const acento = Color(0xFF0088B0);
  static const magenta = Color(0xFFD6006C);
  static const amarillo = Color(0xFFEDBB00);
  static const verde = Color(0xFF2E9D5B);
  static const divisor = Color(0x1F201E1D);
}

const _radio = BorderRadius.all(Radius.circular(16));
const _radioControl = BorderRadius.all(Radius.circular(14));

final ThemeData appTheme = _construirTema();

ThemeData _construirTema() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.magenta,
    primary: AppColors.magenta,
    onPrimary: Colors.white,
    secondary: AppColors.acento,
    onSecondary: Colors.white,
    tertiary: AppColors.amarillo,
    onTertiary: AppColors.texto,
    surface: AppColors.fondo,
    onSurface: AppColors.texto,
    onSurfaceVariant: AppColors.textoSuave,
    surfaceContainerLowest: Colors.white,
    surfaceContainerLow: Colors.white,
    surfaceContainer: AppColors.superficie,
    outlineVariant: AppColors.divisor,
  );

  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.fondo,
    dividerColor: AppColors.divisor,
    textTheme: base.textTheme.copyWith(
      headlineSmall: base.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
      titleLarge: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      titleMedium: base.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.fondo,
      foregroundColor: AppColors.texto,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.texto),
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: _radio,
        side: BorderSide(color: AppColors.divisor),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: const StadiumBorder(),
        minimumSize: const Size(64, 52),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: const StadiumBorder(),
        minimumSize: const Size(64, 48),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: _radioControl),
      enabledBorder: OutlineInputBorder(
        borderRadius: _radioControl,
        borderSide: BorderSide(color: AppColors.divisor),
      ),
    ),
    chipTheme: const ChipThemeData(shape: StadiumBorder()),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.magenta.withValues(alpha: 0.12),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? AppColors.magenta : AppColors.textoSuave,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? AppColors.magenta : AppColors.textoSuave,
        ),
      ),
    ),
  );
}
