import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../carro_providers.dart';

// Ícono de la pestaña Carro con la cantidad de productos.
class IconoCarro extends ConsumerWidget {
  const IconoCarro({super.key, this.seleccionado = false});

  final bool seleccionado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lineas = ref.watch(lineasEnCarroProvider);
    final icono = Icon(seleccionado ? Icons.shopping_cart : Icons.shopping_cart_outlined);
    if (lineas == 0) return icono;
    return Badge(label: Text('$lineas'), child: icono);
  }
}
