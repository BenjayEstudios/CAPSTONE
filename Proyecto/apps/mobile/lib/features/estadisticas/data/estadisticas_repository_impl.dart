import '../../../core/network/parseo.dart';
import '../domain/estadisticas.dart';
import '../domain/estadisticas_repository.dart';
import 'estadisticas_datasource.dart';

String _dia(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

class EstadisticasRepositoryImpl implements EstadisticasRepository {
  const EstadisticasRepositoryImpl(this._datasource);

  final EstadisticasDatasource _datasource;

  @override
  Future<ResumenVentas> ventas({required DateTime desde, required DateTime hasta}) async {
    final j = await _datasource.ventas({'desde': _dia(desde), 'hasta': _dia(hasta)});
    return parsear(() {
      final t = j['totales'] as Map<String, dynamic>;
      return ResumenVentas(
        totales: TotalesVentas(
          envios: t['envios'] as int,
          ventas: t['ventas'] as int,
          despacho: t['despacho'] as int,
          comision: t['comision'] as int,
          neto: t['neto'] as int,
        ),
        semanas: [
          for (final s in j['semanas'] as List)
            VentaSemanal(
              semana: DateTime.parse('${s['semana']}T00:00:00Z'),
              envios: s['envios'] as int,
              ventas: s['ventas'] as int,
              neto: s['neto'] as int,
            ),
        ],
        productos: [
          for (final p in j['productos'] as List)
            VentaProducto(
              productoId: p['productoId'] as int,
              nombre: p['nombre'] as String,
              unidades: p['unidades'] as int,
              ventas: p['ventas'] as int,
            ),
        ],
      );
    });
  }

  @override
  Future<Visitas> visitas({required DateTime desde, required DateTime hasta}) async {
    final j = await _datasource.visitas({'desde': _dia(desde), 'hasta': _dia(hasta)});
    return parsear(() {
      final t = j['totales'] as Map<String, dynamic>;
      final comunas = j['porComuna'] as List?;
      return Visitas(
        vistas: t['vistas'] as int,
        clicks: t['clicks'] as int,
        conversion: (j['conversionVistaClick'] as num).toDouble(),
        porDia: [
          for (final d in j['porDia'] as List)
            VisitasDia(
              fecha: DateTime.parse('${d['fecha']}T00:00:00Z'),
              vistas: d['vistas'] as int,
              clicks: d['clicks'] as int,
            ),
        ],
        porProducto: [
          for (final o in j['porOferta'] as List)
            VisitasProducto(
              ofertaId: o['ofertaId'] as int,
              productoId: o['productoId'] as int,
              producto: o['producto'] as String,
              vistas: o['vistas'] as int,
              clicks: o['clicks'] as int,
              conversion: (o['conversionVistaClick'] as num).toDouble(),
            ),
        ],
        porComuna: comunas == null
            ? null
            : [
                for (final c in comunas)
                  DemandaComuna(
                    comuna: c['comuna'] as String,
                    vistas: c['vistas'] as int,
                    clicks: c['clicks'] as int,
                    cubre: c['cubre'] as bool? ?? false,
                  ),
              ],
      );
    });
  }
}
