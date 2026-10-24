import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Configuración de compilación. Se inyecta con --dart-define (o
// --dart-define-from-file=.env, ver .env.example); no hay lectura de .env en
// runtime.
class AppConfig {
  const AppConfig({required this.apiUrl, required this.usarFakes});

  // API_URL vacía = default según plataforma (ver _apiUrlPorDefecto).
  // USE_FAKES=true (default) hace que los repositorios usen los datasources
  // fake con datos del seed en vez de apps/backend; con false, todos van a la
  // API real. El contrato que debe cumplir la API está en API_CONTRACT.md.
  factory AppConfig.desdeEntorno() {
    const apiUrl = String.fromEnvironment('API_URL');
    const usarFakes = bool.fromEnvironment('USE_FAKES', defaultValue: true);
    return AppConfig(
      apiUrl: apiUrl.isNotEmpty ? apiUrl : _apiUrlPorDefecto(),
      usarFakes: usarFakes,
    );
  }

  final String apiUrl;
  final bool usarFakes;

  // En el emulador de Android "localhost" es el propio emulador; el host se
  // ve como 10.0.2.2. Un dispositivo físico necesita API_URL explícita con la
  // IP de la máquina en la red local.
  static String _apiUrlPorDefecto() {
    final esAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
    return esAndroid ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
  }
}

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.desdeEntorno());
