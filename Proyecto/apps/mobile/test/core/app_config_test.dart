import 'package:cotizapp_mobile/core/config/app_config.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(() => debugDefaultTargetPlatformOverride = null);

  test('en Android apunta al host del emulador', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    expect(AppConfig.desdeEntorno().apiUrl, 'http://10.0.2.2:8000');
  });

  test('fuera de Android apunta a localhost', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    expect(AppConfig.desdeEntorno().apiUrl, 'http://localhost:8000');
  });

  test('por defecto usa fakes', () {
    expect(AppConfig.desdeEntorno().usarFakes, isTrue);
  });
}
