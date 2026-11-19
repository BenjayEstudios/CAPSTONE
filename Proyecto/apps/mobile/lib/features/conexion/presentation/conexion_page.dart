import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/config/app_config.dart';
import '../../../core/error/failure.dart';
import '../../../core/format/formatos.dart';
import '../../../core/theme/app_theme.dart';
import 'conexion_providers.dart';

// Pantalla de diagnóstico: a qué API apunta la app, si usa fakes y si
// apps/backend responde. Que el backend no esté levantado es un caso
// esperado (con USE_FAKES=true la app funciona igual), así que se muestra
// como un estado más, no como error.
class ConexionPage extends ConsumerWidget {
  const ConexionPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appConfigProvider);
    final estado = ref.watch(estadoBackendProvider);
    final probando = estado.isLoading;

    final resultado = estado.when(
      loading: () => const _Resultado(
        icono: Icons.wifi_tethering_rounded,
        color: AppColors.acento,
        titulo: 'Probando conexión…',
        detalle: 'Consultando GET /health-check',
        cargando: true,
      ),
      data: (e) => e.ok
          ? _Resultado(
              icono: Icons.check_circle_rounded,
              color: AppColors.verde,
              titulo: 'Backend conectado',
              detalle: e.horaServidor != null
                  ? 'Hora del servidor: ${formatearFechaHora(e.horaServidor!)}'
                  : 'GET /health-check respondió ok',
            )
          : const _Resultado(
              icono: Icons.report_outlined,
              color: AppColors.amarillo,
              titulo: 'El backend respondió, pero no está ok',
              detalle: 'GET /health-check no devolvió status "ok".',
            ),
      error: (error, _) => _resultadoDeError(error),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Conexión')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          resultado,
          if (estado.hasError && config.usarFakes) ...[
            const SizedBox(height: 12),
            const _Nota(
              texto: 'No pasa nada: la app está usando datos de prueba (USE_FAKES=true) '
                  'y todas las pantallas funcionan sin backend.',
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: probando ? null : () => ref.invalidate(estadoBackendProvider),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Volver a probar'),
          ),
          const SizedBox(height: 24),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.link_rounded),
                  title: const Text('API'),
                  subtitle: Text(config.apiUrl),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(Icons.science_outlined),
                  title: const Text('Datos'),
                  subtitle: Text(
                      config.usarFakes ? 'Datos de prueba del seed (USE_FAKES=true)' : 'API real (USE_FAKES=false)'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  _Resultado _resultadoDeError(Object error) {
    return switch (error) {
      NetworkFailure() => const _Resultado(
          icono: Icons.cloud_off_rounded,
          color: AppColors.textoSuave,
          titulo: 'Sin conexión con el backend',
          detalle: 'No hay respuesta en esa dirección. ¿Está levantado apps/backend?',
        ),
      // 404 o una respuesta que no es JSON: hay otro servicio en ese puerto.
      NotFoundFailure() => const _Resultado(
          icono: Icons.help_outline_rounded,
          color: AppColors.amarillo,
          titulo: 'Responde otro servicio',
          detalle: 'En esa dirección hay un servidor, pero no es el backend de Cotizapp. Revisa API_URL o el puerto.',
        ),
      Failure(:final message) => _Resultado(
          icono: Icons.report_outlined,
          color: AppColors.amarillo,
          titulo: 'El backend respondió con error',
          detalle: message,
        ),
      _ => const _Resultado(
          icono: Icons.report_outlined,
          color: AppColors.amarillo,
          titulo: 'No se pudo comprobar la conexión',
          detalle: 'Ocurrió un error inesperado.',
        ),
    };
  }
}

class _Resultado extends StatelessWidget {
  const _Resultado({
    required this.icono,
    required this.color,
    required this.titulo,
    required this.detalle,
    this.cargando = false,
  });

  final IconData icono;
  final Color color;
  final String titulo;
  final String detalle;
  final bool cargando;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
        child: Column(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(shape: BoxShape.circle, color: color.withValues(alpha: 0.14)),
              child: cargando
                  ? Padding(
                      padding: const EdgeInsets.all(22),
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: color),
                    )
                  : Icon(icono, size: 36, color: color),
            ),
            const SizedBox(height: 16),
            Text(titulo, style: textTheme.titleMedium, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(
              detalle,
              style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _Nota extends StatelessWidget {
  const _Nota({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.acento.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.acento, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(texto, style: const TextStyle(height: 1.35))),
        ],
      ),
    );
  }
}
