import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import 'sesion_controller.dart';

// Pestaña "Cuenta", común a los dos perfiles.
class CuentaPage extends ConsumerWidget {
  const CuentaPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider).valueOrNull;
    // Durante el logout el router todavía no saca esta pantalla.
    if (sesion == null) return const Scaffold();
    final usuario = sesion.usuario;

    return Scaffold(
      appBar: AppBar(title: const Text('Cuenta')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Container(
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
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppColors.magenta,
                  child: Text(
                    _iniciales(usuario.organizacion.nombre),
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(usuario.nombre,
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(usuario.email,
                          style: const TextStyle(color: Colors.white70), overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${sesion.perfil.etiqueta} · ${usuario.organizacion.nombre}',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.wifi_tethering_rounded, color: AppColors.acento),
                  title: const Text('Diagnóstico de conexión'),
                  subtitle: const Text('Revisa si la app llega al servidor'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(Rutas.conexion),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.logout_rounded, color: AppColors.magenta),
                  title: const Text('Cerrar sesión', style: TextStyle(color: AppColors.magenta)),
                  onTap: () => ref.read(sesionProvider.notifier).cerrarSesion(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// "Los Andes Food Service" -> "LA"; "FrigoSur" -> "FR".
String _iniciales(String nombre) {
  final palabras = nombre.split(' ').where((p) => p.isNotEmpty).toList();
  if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
  return nombre.substring(0, nombre.length >= 2 ? 2 : nombre.length).toUpperCase();
}
