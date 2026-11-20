import 'package:cotizapp_mobile/core/router/redireccion.dart';
import 'package:cotizapp_mobile/core/router/rutas.dart';
import 'package:cotizapp_mobile/features/auth/domain/perfil.dart';
import 'package:cotizapp_mobile/features/auth/domain/sesion.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Sesion _sesion(Perfil perfil) => Sesion(
      token: 't',
      perfil: perfil,
      usuario: const UsuarioSesion(
        id: 1,
        nombre: 'x',
        email: 'x@x.cl',
        rol: 'x',
        organizacion: OrganizacionSesion(id: 1, nombre: 'x', tipo: 'cliente'),
      ),
    );

void main() {
  const cargando = AsyncLoading<Sesion?>();
  const sinSesion = AsyncData<Sesion?>(null);
  final comprador = AsyncData<Sesion?>(_sesion(Perfil.comprador));
  final proveedor = AsyncData<Sesion?>(_sesion(Perfil.proveedor));

  test('mientras restaura la sesión todo va al splash', () {
    expect(redirigir(cargando, Rutas.splash), isNull);
    expect(redirigir(cargando, Rutas.comprador), Rutas.splash);
  });

  test('sin sesión solo se ven login y conexión', () {
    expect(redirigir(sinSesion, Rutas.splash), Rutas.login);
    expect(redirigir(sinSesion, Rutas.compradorCarro), Rutas.login);
    expect(redirigir(sinSesion, Rutas.login), isNull);
    expect(redirigir(sinSesion, Rutas.conexion), isNull);
  });

  test('error al restaurar se trata como sin sesión', () {
    expect(redirigir(AsyncError<Sesion?>(Exception(), StackTrace.empty), Rutas.splash), Rutas.login);
  });

  test('con sesión, splash y login llevan al inicio del perfil', () {
    expect(redirigir(comprador, Rutas.login), Rutas.comprador);
    expect(redirigir(proveedor, Rutas.splash), Rutas.proveedor);
  });

  test('cada perfil no puede entrar a las rutas del otro', () {
    expect(redirigir(comprador, Rutas.proveedorOrdenes), Rutas.comprador);
    expect(redirigir(proveedor, Rutas.compradorCarro), Rutas.proveedor);
    expect(redirigir(comprador, Rutas.compradorCarro), isNull);
    expect(redirigir(proveedor, Rutas.proveedorAlertas), isNull);
    expect(redirigir(comprador, Rutas.conexion), isNull);
  });
}
