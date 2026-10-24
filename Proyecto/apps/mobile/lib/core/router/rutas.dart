import '../../features/auth/domain/perfil.dart';

// Paths de go_router en un solo lugar, para no repetir strings sueltos en
// cada context.go(). Cada perfil vive bajo su propio prefijo, así el
// redirect puede impedir que un comprador entre a /proveedor/* y viceversa.
abstract final class Rutas {
  static const splash = '/';
  static const login = '/login';
  static const conexion = '/conexion';

  static const comprador = '/comprador';
  static const compradorCarro = '/comprador/carro';
  static const compradorPedidos = '/comprador/pedidos';
  static const compradorCuenta = '/comprador/cuenta';

  static const proveedor = '/proveedor';
  static const proveedorOrdenes = '/proveedor/ordenes';
  static const proveedorCalificaciones = '/proveedor/calificaciones';
  static const proveedorAlertas = '/proveedor/alertas';
  static const proveedorCuenta = '/proveedor/cuenta';

  static String inicioDe(Perfil perfil) => switch (perfil) {
        Perfil.comprador => comprador,
        Perfil.proveedor => proveedor,
      };
}
