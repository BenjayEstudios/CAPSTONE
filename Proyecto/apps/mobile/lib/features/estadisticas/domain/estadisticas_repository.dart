import 'estadisticas.dart';

abstract interface class EstadisticasRepository {
  // GET /estadisticas/proveedor/ventas?desde&hasta (pendiente en el backend)
  Future<ResumenVentas> ventas({required DateTime desde, required DateTime hasta});

  // GET /estadisticas/proveedor?desde&hasta (existe)
  Future<Visitas> visitas({required DateTime desde, required DateTime hasta});
}
