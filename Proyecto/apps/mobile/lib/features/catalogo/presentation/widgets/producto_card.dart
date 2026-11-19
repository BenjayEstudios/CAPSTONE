import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/format/formatos.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/categoria.dart';
import '../../domain/producto.dart';
import '../catalogo_providers.dart';
import 'visual_categoria.dart';

// Fila del listado / búsqueda / destacados: imagen, nombre, formato, precio
// desde, cuántos proveedores lo venden y cuánto se ahorra eligiendo bien.
class ProductoCard extends ConsumerWidget {
  const ProductoCard({super.key, required this.producto, required this.onTap});

  final ProductoResumen producto;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textTheme = Theme.of(context).textTheme;
    final porUnidad = ref.watch(verPrecioPorUnidadProvider);
    final raiz = ref.watch(categoriasProvider).valueOrNull?.raizDe(producto.categoriaId)?.id;
    final precioUnidad = producto.precioDesdePorUnidad;
    final detalle = [if (producto.marca != null) producto.marca!, if (producto.formato != null) producto.formato!];

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ImagenProducto(raizId: raiz, imagenUrl: producto.imagenUrl),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(producto.nombre,
                        style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    if (detalle.isNotEmpty)
                      Text(detalle.join(' · '),
                          style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 8),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.end,
                      spacing: 6,
                      children: [
                        Text('desde', style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                        Text(
                          porUnidad && precioUnidad != null
                              ? formatearPrecioPorUnidad(precioUnidad, producto.unidad.abreviatura)
                              : formatearClp(producto.precioDesde),
                          style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        _Etiqueta(
                          icono: Icons.storefront_outlined,
                          texto:
                              producto.cantidadOfertas == 1 ? '1 proveedor' : '${producto.cantidadOfertas} proveedores',
                        ),
                        if (producto.plazoMinHoras != null)
                          _Etiqueta(icono: Icons.schedule_rounded, texto: formatearPlazo(producto.plazoMinHoras!)),
                        if (producto.diferencia > 0)
                          _Etiqueta(
                            icono: Icons.trending_down_rounded,
                            texto: 'Ahorra hasta ${formatearClp(producto.diferencia)}',
                            destacada: true,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textoSuave),
            ],
          ),
        ),
      ),
    );
  }
}

class _Etiqueta extends StatelessWidget {
  const _Etiqueta({required this.icono, required this.texto, this.destacada = false});

  final IconData icono;
  final String texto;
  final bool destacada;

  @override
  Widget build(BuildContext context) {
    final color = destacada ? AppColors.verde : AppColors.textoSuave;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: destacada ? AppColors.verde.withValues(alpha: 0.1) : AppColors.superficie,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icono, size: 13, color: color),
          const SizedBox(width: 4),
          // Flexible: en pantallas angostas se corta con "…" en vez de desbordar.
          Flexible(
            child: Text(
              texto,
              style: TextStyle(fontSize: 11.5, color: color, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
