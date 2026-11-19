import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// Placeholder de las pestañas cuyo ticket todavía no se implementa, para
// que la navegación de cada perfil quede completa desde KAN-126.
// encabezado: contenido real que ya se puede mostrar arriba (ej. Saludo).
class PantallaPendiente extends StatelessWidget {
  const PantallaPendiente({
    super.key,
    required this.titulo,
    required this.ticket,
    required this.descripcion,
    required this.icono,
    this.encabezado,
  });

  final String titulo;
  final String ticket;
  final String descripcion;
  final IconData icono;
  final Widget? encabezado;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (encabezado != null) ...[encabezado!, const SizedBox(height: 24)],
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
              child: Column(
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(colors: [
                        AppColors.magenta.withValues(alpha: 0.14),
                        AppColors.acento.withValues(alpha: 0.14),
                      ]),
                    ),
                    child: Icon(icono, size: 44, color: AppColors.magenta),
                  ),
                  const SizedBox(height: 20),
                  Text(descripcion, style: textTheme.titleMedium, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  Text(
                    'Estamos construyendo esta sección.',
                    style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.amarillo.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text('Próximamente · $ticket',
                        style: textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
