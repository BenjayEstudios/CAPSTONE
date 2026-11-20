import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_config.dart';
import '../../../core/error/failure.dart';
import '../../../core/fake/seed.dart';
import '../../../core/router/rutas.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/marca.dart';
import 'ilustracion_productos.dart';
import 'sesion_controller.dart';

// Usuarios del seed para entrar con un toque en la demo.
const _accesosDemo = [
  (titulo: 'Comprador', detalle: 'El Fogón', email: 'compras@elfogon.test', icono: Icons.storefront_rounded),
  (titulo: 'Distribuidor', detalle: 'Los Andes', email: 'ventas@losandes.test', icono: Icons.local_shipping_rounded),
];

final _formatoEmail = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _clave = TextEditingController();
  bool _enviando = false;
  bool _verClave = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _clave.dispose();
    super.dispose();
  }

  // Si sale bien, el router redirige solo al inicio del perfil.
  Future<void> _ingresar() async {
    if (_enviando || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await ref.read(sesionProvider.notifier).iniciarSesion(email: _email.text, clave: _clave.text);
    } on Failure catch (f) {
      if (mounted) setState(() => _error = f.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Ocurrió un error inesperado.');
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  // Llena el formulario a la vista (para que se entienda en la demo) e
  // ingresa.
  void _entrarComo(String email) {
    _email.text = email;
    _clave.text = claveSeed;
    _ingresar();
  }

  @override
  Widget build(BuildContext context) {
    final usarFakes = ref.watch(appConfigProvider).usarFakes;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.tinta,
        body: Stack(
          children: [
            const Positioned(left: 0, right: 0, bottom: 0, child: OndasDecorativas(alto: 150)),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Theme(
                      data: _temaOscuro(Theme.of(context)),
                      child: _formulario(context, usarFakes),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _formulario(BuildContext context, bool usarFakes) {
    final textTheme = Theme.of(context).textTheme;
    return Form(
      key: _formKey,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const MarcaCotizapp(tamano: 36),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.wifi_tethering_rounded, color: Colors.white70),
                  tooltip: 'Diagnóstico de conexión',
                  onPressed: () => context.push(Rutas.conexion),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const IlustracionProductos(alto: 180),
            const SizedBox(height: 20),
            Text(
              'Compra mejor para tu negocio',
              style: textTheme.headlineSmall?.copyWith(color: Colors.white),
            ),
            const SizedBox(height: 6),
            Text(
              'Compara precio, plazo y calificación de varios distribuidores y paga una sola vez.',
              style: textTheme.bodyMedium?.copyWith(color: Colors.white70, height: 1.4),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _email,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Correo',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              autocorrect: false,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Ingresa tu correo';
                if (!_formatoEmail.hasMatch(v.trim())) return 'Correo no válido';
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _clave,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Clave',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  icon: Icon(_verClave ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                  tooltip: _verClave ? 'Ocultar clave' : 'Mostrar clave',
                  onPressed: () => setState(() => _verClave = !_verClave),
                ),
              ),
              obscureText: !_verClave,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _ingresar(),
              validator: (v) => v == null || v.isEmpty ? 'Ingresa tu clave' : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              _AvisoError(mensaje: _error!),
            ],
            const SizedBox(height: 22),
            FilledButton(
              onPressed: _enviando ? null : _ingresar,
              style: FilledButton.styleFrom(
                disabledBackgroundColor: AppColors.magenta.withValues(alpha: 0.5),
              ),
              child: _enviando
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : const Text('Ingresar'),
            ),
            if (usarFakes) ...[
              const SizedBox(height: 28),
              Row(
                children: [
                  const Expanded(child: Divider(color: Colors.white24)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('Acceso rápido de demo', style: textTheme.labelMedium?.copyWith(color: Colors.white60)),
                  ),
                  const Expanded(child: Divider(color: Colors.white24)),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  for (final (i, acceso) in _accesosDemo.indexed) ...[
                    if (i > 0) const SizedBox(width: 12),
                    Expanded(
                      child: _TarjetaDemo(
                        titulo: acceso.titulo,
                        detalle: acceso.detalle,
                        icono: acceso.icono,
                        onTap: _enviando ? null : () => _entrarComo(acceso.email),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  // Inputs translúcidos con bordes redondeados sobre el fondo tinta.
  ThemeData _temaOscuro(ThemeData base) {
    const borde = BorderRadius.all(Radius.circular(28));
    return base.copyWith(
      textSelectionTheme: const TextSelectionThemeData(cursorColor: Colors.white),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.07),
        labelStyle: const TextStyle(color: Colors.white60),
        floatingLabelStyle: const TextStyle(color: Colors.white),
        prefixIconColor: Colors.white60,
        suffixIconColor: Colors.white60,
        errorStyle: const TextStyle(color: Color(0xFFFF8FB8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        border: const OutlineInputBorder(borderRadius: borde),
        enabledBorder: const OutlineInputBorder(borderRadius: borde, borderSide: BorderSide(color: Colors.white24)),
        focusedBorder: const OutlineInputBorder(
          borderRadius: borde,
          borderSide: BorderSide(color: Color(0xFFFF3D8B), width: 1.6),
        ),
        errorBorder: const OutlineInputBorder(borderRadius: borde, borderSide: BorderSide(color: Color(0xFFFF8FB8))),
        focusedErrorBorder: const OutlineInputBorder(
          borderRadius: borde,
          borderSide: BorderSide(color: Color(0xFFFF8FB8), width: 1.6),
        ),
      ),
    );
  }
}

class _AvisoError extends StatelessWidget {
  const _AvisoError({required this.mensaje});

  final String mensaje;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.magenta.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.magenta.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: Color(0xFFFF8FB8), size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(mensaje, style: const TextStyle(color: Colors.white))),
        ],
      ),
    );
  }
}

class _TarjetaDemo extends StatelessWidget {
  const _TarjetaDemo({required this.titulo, required this.detalle, required this.icono, this.onTap});

  final String titulo;
  final String detalle;
  final IconData icono;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.tintaClara,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.magenta.withValues(alpha: 0.2),
                child: Icon(icono, size: 20, color: const Color(0xFFFF7AAE)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(titulo, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    Text(
                      detalle,
                      style: const TextStyle(color: Colors.white60, fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
