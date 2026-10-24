import 'package:cotizapp_mobile/core/error/failure.dart';
import 'package:cotizapp_mobile/features/auth/data/auth_datasource.dart';
import 'package:cotizapp_mobile/features/auth/data/auth_fake_datasource.dart';
import 'package:cotizapp_mobile/features/auth/data/auth_repository_impl.dart';
import 'package:cotizapp_mobile/features/auth/domain/perfil.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pruebas.dart';

class _RespuestaFija implements AuthDatasource {
  const _RespuestaFija(this.json);
  final Map<String, dynamic> json;

  @override
  Future<Map<String, dynamic>> login({required String email, required String clave}) async => json;
}

void main() {
  late SesionEnMemoria local;
  late AuthRepositoryImpl repo;

  setUp(() {
    local = SesionEnMemoria();
    repo = AuthRepositoryImpl(const AuthFakeDatasource(latencia: Duration.zero), local);
  });

  test('comprador del seed entra con perfil comprador', () async {
    final sesion = await repo.iniciarSesion(email: 'compras@elfogon.test', clave: 'Cotizapp.2026');
    expect(sesion.perfil, Perfil.comprador);
    expect(sesion.usuario.id, 8);
    expect(sesion.usuario.organizacion.nombre, 'El Fogón');
  });

  test('proveedor del seed entra con perfil proveedor (ignora mayúsculas y espacios)', () async {
    final sesion = await repo.iniciarSesion(email: '  Ventas@LosAndes.test ', clave: 'Cotizapp.2026');
    expect(sesion.perfil, Perfil.proveedor);
    expect(sesion.usuario.organizacion.id, 2);
  });

  test('clave incorrecta es UnauthorizedFailure', () {
    expect(
      repo.iniciarSesion(email: 'compras@elfogon.test', clave: 'otra'),
      throwsA(isA<UnauthorizedFailure>()),
    );
  });

  test('proveedor invitado (Las Palmas, en revisión) no puede entrar', () {
    expect(
      repo.iniciarSesion(email: 'contacto@laspalmas.test', clave: 'Cotizapp.2026'),
      throwsA(isA<ForbiddenFailure>()),
    );
  });

  test('roles internos se rechazan y no se guarda nada', () async {
    await expectLater(
      repo.iniciarSesion(email: 'admin@cotizapp.test', clave: 'Cotizapp.2026'),
      throwsA(isA<ForbiddenFailure>()),
    );
    expect(local.guardada, isNull);
  });

  test('la sesión queda guardada y se restaura; logout la borra', () async {
    await repo.iniciarSesion(email: 'compras@dulcehogar.test', clave: 'Cotizapp.2026');

    final otraApertura = AuthRepositoryImpl(const AuthFakeDatasource(latencia: Duration.zero), local);
    final restaurada = await otraApertura.sesionGuardada();
    expect(restaurada?.usuario.email, 'compras@dulcehogar.test');
    expect(restaurada?.perfil, Perfil.comprador);

    await otraApertura.cerrarSesion();
    expect(await otraApertura.sesionGuardada(), isNull);
  });

  test('sesión guardada corrupta se descarta', () async {
    local.guardada = {'token': 'x'};
    expect(await repo.sesionGuardada(), isNull);
    expect(local.guardada, isNull);
  });

  test('respuesta de login con forma inesperada es ServerFailure', () {
    final roto = AuthRepositoryImpl(const _RespuestaFija({'token': 1}), local);
    expect(roto.iniciarSesion(email: 'a@b.cl', clave: 'x'), throwsA(isA<ServerFailure>()));
  });
}
