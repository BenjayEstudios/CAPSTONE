import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/fake/fake_providers.dart';
import '../../../core/network/api_client.dart';
import '../../auth/domain/perfil.dart';
import '../../auth/presentation/sesion_controller.dart';
import '../../catalogo/domain/producto.dart';
import '../../catalogo/presentation/catalogo_providers.dart';
import '../data/carro_datasource.dart';
import '../data/carro_fake_datasource.dart';
import '../data/carro_remote_datasource.dart';
import '../data/carro_repository_impl.dart';
import '../domain/carro.dart';
import '../domain/carro_repository.dart';

// GET/PUT /carro existen en el backend, pero sin POST /auth/login para
// clientes no hay token: con USE_FAKES=true se usa FakeBackend.
final carroDatasourceProvider = Provider<CarroDatasource>((ref) {
  if (ref.watch(appConfigProvider).usarFakes) {
    return CarroFakeDatasource(ref.watch(fakeBackendProvider), ref.watch(usuarioFakeProvider),
        latencia: ref.watch(latenciaFakeProvider));
  }
  return CarroRemoteDatasource(ref.watch(apiClientProvider));
});

final carroRepositoryProvider = Provider<CarroRepository>((ref) {
  return CarroRepositoryImpl(ref.watch(carroDatasourceProvider), ref.watch(catalogoRepositoryProvider));
});

// Estado del carro del comprador. Se reconstruye al cambiar la sesión (otro
// usuario, logout); para el distribuidor queda vacío y no llama a la API.
class CarroController extends AsyncNotifier<CarroDetallado> {
  @override
  Future<CarroDetallado> build() async {
    final sesion = ref.watch(sesionProvider).valueOrNull;
    if (sesion == null || sesion.perfil != Perfil.comprador) return CarroDetallado.vacio;
    return ref.watch(carroRepositoryProvider).obtener();
  }

  List<ItemCarro> get _items => state.valueOrNull?.items ?? const [];

  // Mientras se guarda se conserva el carro anterior en pantalla; si el
  // backend rechaza el cambio, se vuelve a él y el Failure sube a la UI.
  Future<void> _guardar(List<ItemCarro> items) async {
    final anterior = state;
    state = const AsyncLoading<CarroDetallado>().copyWithPrevious(anterior);
    try {
      state = AsyncData(await ref.read(carroRepositoryProvider).guardar(items));
    } catch (_) {
      state = anterior;
      rethrow;
    }
  }

  // Desde el comparador. Si la oferta ya está, suma; si no, entra con la
  // cantidad mínima y el precio que se está viendo.
  Future<void> agregar(OfertaProducto oferta, {int? cantidad}) {
    final minima = ((oferta.minimoCompra ?? 1) / ((oferta.unidadesPorCaja ?? 1) <= 0 ? 1 : oferta.unidadesPorCaja!))
        .ceil()
        .clamp(1, 1 << 30);
    final suma = cantidad ?? minima;
    final existente = _items.where((i) => i.ofertaId == oferta.id).firstOrNull;
    return _guardar([
      for (final i in _items)
        if (i.ofertaId == oferta.id)
          ItemCarro(ofertaId: i.ofertaId, cantidad: i.cantidad + suma, precioVisto: oferta.precioUnitario)
        else
          i,
      if (existente == null) ItemCarro(ofertaId: oferta.id, cantidad: suma, precioVisto: oferta.precioUnitario),
    ]);
  }

  Future<void> cambiarCantidad(int ofertaId, int cantidad) => _guardar([
        for (final i in _items)
          if (i.ofertaId == ofertaId)
            ItemCarro(ofertaId: i.ofertaId, cantidad: cantidad, precioVisto: i.precioVisto)
          else
            i,
      ]);

  Future<void> quitar(int ofertaId) => _guardar([
        for (final i in _items)
          if (i.ofertaId != ofertaId) i
      ]);

  // Acepta los precios actuales (después de un PRECIO_CAMBIO) y saca lo que
  // ya no está publicado.
  Future<void> actualizarPrecios() => _guardar([
        for (final i in _items)
          if (i.disponible) ItemCarro(ofertaId: i.ofertaId, cantidad: i.cantidad, precioVisto: i.precio),
      ]);

  // Tras confirmar, el backend deja el carro vacío: se relee.
  Future<void> recargar() async {
    ref.invalidateSelf();
    await future;
  }
}

final carroProvider = AsyncNotifierProvider<CarroController, CarroDetallado>(CarroController.new);

// Para el badge de la pestaña: líneas en el carro (no unidades).
final lineasEnCarroProvider = Provider<int>((ref) => ref.watch(carroProvider).valueOrNull?.cantidadLineas ?? 0);
