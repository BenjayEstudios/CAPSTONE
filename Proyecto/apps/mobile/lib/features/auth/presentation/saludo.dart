import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/perfil.dart';
import 'sesion_controller.dart';

// Tarjeta de bienvenida con el nombre de la organización, para la pestaña
// de inicio de cada perfil.
class Saludo extends ConsumerWidget {
  const Saludo({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider).valueOrNull;
    if (sesion == null) return const SizedBox.shrink();
    final esComprador = sesion.perfil == Perfil.comprador;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.tinta, AppColors.tintaClara],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hola, ${sesion.usuario.organizacion.nombre}',
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  esComprador
                      ? 'Compara proveedores y arma tu pedido en un solo carro.'
                      : 'Revisa cómo van tus ventas y lo que necesita tu atención.',
                  style: const TextStyle(color: Colors.white70, height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.magenta,
            child: Icon(
              esComprador ? Icons.storefront_rounded : Icons.local_shipping_rounded,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
