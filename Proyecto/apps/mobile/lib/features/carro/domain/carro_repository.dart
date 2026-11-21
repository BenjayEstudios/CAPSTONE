import 'carro.dart';

abstract interface class CarroRepository {
  // GET /carro, con cada línea completada con su ficha del catálogo.
  Future<CarroDetallado> obtener();

  // PUT /carro: reemplaza todos los ítems (es lo que expone la API).
  Future<CarroDetallado> guardar(List<ItemCarro> items);
}
