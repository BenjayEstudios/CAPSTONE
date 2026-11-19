import 'package:flutter/material.dart';
import '../../auth/presentation/saludo.dart';
import 'ventas_view.dart';
import 'visitas_view.dart';

// Pestaña Resumen del distribuidor: ventas (KAN-133) y visitas y conversión
// (KAN-134).
class ResumenProveedorPage extends StatefulWidget {
  const ResumenProveedorPage({super.key});

  @override
  State<ResumenProveedorPage> createState() => _ResumenProveedorPageState();
}

class _ResumenProveedorPageState extends State<ResumenProveedorPage> {
  bool _visitas = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Resumen')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const Saludo(),
          const SizedBox(height: 16),
          SegmentedButton<bool>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: false, label: Text('Ventas'), icon: Icon(Icons.payments_outlined)),
              ButtonSegment(value: true, label: Text('Visitas'), icon: Icon(Icons.visibility_outlined)),
            ],
            selected: {_visitas},
            onSelectionChanged: (s) => setState(() => _visitas = s.first),
          ),
          const SizedBox(height: 16),
          if (_visitas) const VisitasView() else const VentasView(),
        ],
      ),
    );
  }
}

// Título de sección con subtítulo opcional y acción a la derecha.
class TituloSeccion extends StatelessWidget {
  const TituloSeccion({super.key, required this.titulo, this.subtitulo, this.accion});

  final String titulo;
  final String? subtitulo;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titulo, style: textTheme.titleMedium),
                if (subtitulo != null)
                  Text(subtitulo!, style: textTheme.bodySmall?.copyWith(color: const Color(0xFF6B6878))),
              ],
            ),
          ),
          if (accion != null) accion!,
        ],
      ),
    );
  }
}
