import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/error/failure.dart';
import '../../../core/format/formatos.dart';
import '../../../core/format/rut.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/estado_views.dart';
import '../../auth/presentation/sesion_controller.dart';
import '../../carro/domain/carro.dart';
import '../../carro/presentation/carro_providers.dart';
import '../../catalogo/domain/producto.dart';
import '../../ordenes/domain/orden.dart';
import '../../ordenes/presentation/ordenes_providers.dart';
import '../domain/checkout.dart';
import 'checkout_providers.dart';
import 'errores_checkout.dart';
import 'iniciar_pago.dart';

final _formatoEmail = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

// Checkout en tres pasos (KAN-131), como el mockup ClienteMovil:
// 1 quién compra, 2 entrega (despacho o retiro por proveedor), 3 pago.
// Confirma con POST /carro/confirmar y abre la pasarela.
class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({super.key});

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  final _form = GlobalKey<FormState>();
  late final _nombre = TextEditingController(text: ref.read(sesionProvider).valueOrNull?.usuario.nombre ?? '');
  late final _correo = TextEditingController(text: ref.read(sesionProvider).valueOrNull?.usuario.email ?? '');
  final _rut = TextEditingController();
  final _calle = TextEditingController();
  final _numero = TextEditingController();
  final _complemento = TextEditingController();
  final _referencia = TextEditingController();

  bool _empresa = false;
  // null = "otra dirección" (se escribe una nueva).
  int? _direccionId;
  bool _direccionElegida = false;
  int? _comunaId;
  final _retiros = <int, int>{};
  MedioPago _medio = MedioPago.tarjeta;
  bool _enviando = false;

  @override
  void dispose() {
    for (final c in [_nombre, _correo, _rut, _calle, _numero, _complemento, _referencia]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pagar(CarroDetallado carro) async {
    if (_enviando || !_form.currentState!.validate()) return;
    final necesitaDespacho = carro.grupos.any((g) => !_retiros.containsKey(g.proveedorId));
    final pedido = PedidoCheckout(
      direccionId: necesitaDespacho ? _direccionId : null,
      direccionNueva: necesitaDespacho && _direccionId == null
          ? DireccionNueva(
              comunaId: _comunaId!,
              calle: _calle.text,
              numero: _numero.text,
              complemento: _complemento.text,
              referencia: _referencia.text,
            )
          : null,
      retiros: Map.of(_retiros),
      requiereFactura: _empresa,
    );

    setState(() => _enviando = true);
    try {
      final orden = await ref.read(checkoutRepositoryProvider).confirmar(pedido);
      // El backend dejó el carro vacío y hay una orden nueva.
      ref
        ..invalidate(carroProvider)
        ..invalidate(ordenesProvider);
      if (!mounted) return;
      await iniciarPagoYAbrir(context, ref, orden.ordenId, _medio);
    } on Failure catch (f) {
      if (!mounted) return;
      setState(() => _enviando = false);
      await _mostrarError(f);
    }
  }

  Future<void> _mostrarError(Failure f) {
    final alCarro = seArreglaEnElCarro(f);
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('No pudimos crear el pedido'),
        content: Text(mensajeCheckout(f)),
        actions: [
          if (alCarro)
            FilledButton(
              onPressed: () {
                ref.invalidate(carroProvider);
                Navigator.of(context).pop();
                this.context.pop();
              },
              child: const Text('Revisar el carro'),
            )
          else
            TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Entendido')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final carro = ref.watch(carroProvider);
    final opciones = ref.watch(opcionesEntregaProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Pago')),
      body: switch ((carro, opciones)) {
        (AsyncError(:final error), _) || (_, AsyncError(:final error)) => ErrorView(
            error: error,
            onReintentar: () => ref
              ..invalidate(carroProvider)
              ..invalidate(opcionesEntregaProvider),
          ),
        (AsyncData(value: final c), AsyncData(value: final o)) when !_enviando || c.estaVacio == false =>
          c.estaVacio ? const VacioView(titulo: 'Tu carro está vacío') : _formulario(context, c, o),
        _ => const CargandoView(),
      },
      bottomNavigationBar: switch (carro.valueOrNull) {
        final c? when !c.estaVacio && opciones.hasValue => _BarraPagar(
            total: _total(c),
            enviando: _enviando,
            onPagar: () => _pagar(c),
          ),
        _ => null,
      },
    );
  }

  int _despacho(GrupoCarro g) => _retiros.containsKey(g.proveedorId) ? 0 : g.despachoEstimado;
  int _total(CarroDetallado c) => c.subtotal + c.grupos.fold(0, (s, g) => s + _despacho(g));

  Widget _formulario(BuildContext context, CarroDetallado carro, OpcionesEntrega opciones) {
    final textTheme = Theme.of(context).textTheme;
    // Por defecto, la primera dirección guardada; sin direcciones, una nueva.
    if (!_direccionElegida) {
      _direccionId = opciones.direcciones.firstOrNull?.id;
      _direccionElegida = true;
    }
    final necesitaDespacho = carro.grupos.any((g) => !_retiros.containsKey(g.proveedorId));
    final proveedores = carro.grupos.length;

    return Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          Text(
            'Paga una vez. Repartimos el pedido entre ${proveedores == 1 ? '1 proveedor' : '$proveedores proveedores'}.',
            style: textTheme.bodyMedium?.copyWith(color: AppColors.textoSuave),
          ),
          const SizedBox(height: 16),
          _Paso(
            numero: 1,
            titulo: 'Quién compra',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Persona'), icon: Icon(Icons.person_outline)),
                    ButtonSegment(value: true, label: Text('Empresa'), icon: Icon(Icons.business_outlined)),
                  ],
                  selected: {_empresa},
                  onSelectionChanged: (s) => setState(() {
                    _empresa = s.first;
                    if (!_empresa && _medio == MedioPago.lineaCredito) _medio = MedioPago.tarjeta;
                  }),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _nombre,
                  decoration: InputDecoration(labelText: _empresa ? 'Nombre de contacto' : 'Nombre y apellido'),
                  textCapitalization: TextCapitalization.words,
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Ingresa un nombre' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _rut,
                  decoration: InputDecoration(
                    labelText: _empresa ? 'RUT de la empresa' : 'RUT (opcional)',
                    hintText: '76.111.222-5',
                  ),
                  keyboardType: TextInputType.visiblePassword,
                  onEditingComplete: () {
                    if (rutValido(_rut.text)) _rut.text = formatearRut(_rut.text);
                    FocusScope.of(context).nextFocus();
                  },
                  validator: (v) {
                    final vacio = v == null || v.trim().isEmpty;
                    if (vacio) return _empresa ? 'La factura necesita el RUT de la empresa' : null;
                    return rutValido(v) ? null : 'RUT no válido';
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _correo,
                  decoration: const InputDecoration(labelText: 'Correo'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => _formatoEmail.hasMatch(v?.trim() ?? '') ? null : 'Correo no válido',
                ),
                if (_empresa) ...[
                  const SizedBox(height: 8),
                  Text('Emitimos factura electrónica a nombre de tu empresa.',
                      style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
                ],
              ],
            ),
          ),
          _Paso(
            numero: 2,
            titulo: 'Entrega',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final g in carro.grupos) ...[
                  _EntregaProveedor(
                    grupo: g,
                    puntos: _puntosPermitidos(g, opciones),
                    puntoElegido: _retiros[g.proveedorId],
                    onElegir: (punto) => setState(() {
                      if (punto == null) {
                        _retiros.remove(g.proveedorId);
                      } else {
                        _retiros[g.proveedorId] = punto;
                      }
                    }),
                  ),
                  const SizedBox(height: 10),
                ],
                if (necesitaDespacho) ...[
                  const SizedBox(height: 4),
                  Text('Dirección de despacho', style: textTheme.titleSmall),
                  const SizedBox(height: 4),
                  RadioGroup<int?>(
                    groupValue: _direccionId,
                    onChanged: (v) => setState(() => _direccionId = v),
                    child: Column(
                      children: [
                        for (final d in opciones.direcciones)
                          RadioListTile<int?>(
                            contentPadding: EdgeInsets.zero,
                            value: d.id,
                            title: Text(d.texto),
                            subtitle: d.referencia == null ? null : Text(d.referencia!),
                          ),
                        const RadioListTile<int?>(
                          contentPadding: EdgeInsets.zero,
                          value: null,
                          title: Text('Otra dirección'),
                        ),
                      ],
                    ),
                  ),
                  if (_direccionId == null) _DireccionNuevaForm(this),
                ],
              ],
            ),
          ),
          _Paso(
            numero: 3,
            titulo: 'Pago',
            child: RadioGroup<MedioPago>(
              groupValue: _medio,
              onChanged: (v) => setState(() => _medio = v!),
              child: Column(
                children: [
                  for (final m in MedioPago.values)
                    if (m != MedioPago.lineaCredito || _empresa)
                      RadioListTile<MedioPago>(contentPadding: EdgeInsets.zero, value: m, title: Text(m.etiqueta)),
                ],
              ),
            ),
          ),
          _AsiLlega(carro: carro, despacho: _despacho, retiros: _retiros, opciones: opciones),
          const SizedBox(height: 12),
          Text(
            'Al pagar aceptas las condiciones de cada proveedor. Si un producto no está disponible, '
            'se devuelve ese monto en 48 h.',
            style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
          ),
        ],
      ),
    );
  }

  // Retiro solo si el proveedor tiene punto de retiro y ninguna oferta del
  // grupo es "solo despacho" (misma regla que RETIRO_NO_DISPONIBLE).
  List<PuntoRetiro> _puntosPermitidos(GrupoCarro g, OpcionesEntrega o) {
    final soloDespacho = g.lineas.any((l) => l.oferta?.modalidad == ModalidadEntrega.despacho);
    return soloDespacho ? const [] : o.puntosDe(g.proveedorId);
  }
}

class _Paso extends StatelessWidget {
  const _Paso({required this.numero, required this.titulo, required this.child});

  final int numero;
  final String titulo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 13,
                    backgroundColor: AppColors.magenta,
                    child: Text('$numero', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 10),
                  Text(titulo, style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
              const SizedBox(height: 14),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

class _EntregaProveedor extends StatelessWidget {
  const _EntregaProveedor(
      {required this.grupo, required this.puntos, required this.puntoElegido, required this.onElegir});

  final GrupoCarro grupo;
  final List<PuntoRetiro> puntos;
  final int? puntoElegido;
  final ValueChanged<int?> onElegir;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final punto = puntos.where((p) => p.id == puntoElegido).firstOrNull;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.fondo, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(grupo.nombre, style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                avatar: const Icon(Icons.local_shipping_outlined, size: 18),
                label: const Text('Despacho'),
                selected: puntoElegido == null,
                onSelected: (_) => onElegir(null),
              ),
              for (final p in puntos)
                ChoiceChip(
                  avatar: const Icon(Icons.store_mall_directory_outlined, size: 18),
                  label: Text('Retiro en ${p.nombre}'),
                  selected: puntoElegido == p.id,
                  onSelected: (_) => onElegir(p.id),
                ),
            ],
          ),
          if (punto != null) ...[
            const SizedBox(height: 6),
            Text('${punto.direccion}${punto.horario == null ? '' : ' · ${punto.horario}'}',
                style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
          ] else if (puntos.isEmpty) ...[
            const SizedBox(height: 6),
            Text('Este proveedor solo despacha.', style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave)),
          ],
        ],
      ),
    );
  }
}

class _DireccionNuevaForm extends ConsumerWidget {
  const _DireccionNuevaForm(this.estado);

  final _CheckoutPageState estado;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final comunas = ref.watch(comunasProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        TextFormField(
          controller: estado._calle,
          decoration: const InputDecoration(labelText: 'Calle'),
          validator: (v) => (v == null || v.trim().isEmpty) ? 'Ingresa la calle' : null,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: estado._numero,
                decoration: const InputDecoration(labelText: 'Número'),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: estado._complemento,
                decoration: const InputDecoration(labelText: 'Depto. / local'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        comunas.when(
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => ErrorView(error: e, onReintentar: () => ref.invalidate(comunasProvider)),
          data: (lista) => DropdownButtonFormField<int>(
            initialValue: estado._comunaId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Comuna'),
            items: [
              for (final c in lista) DropdownMenuItem(value: c.id, child: Text('${c.nombre} (${c.regionNombre})')),
            ],
            onChanged: (v) => estado._comunaId = v,
            validator: (v) => v == null ? 'Elige la comuna' : null,
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: estado._referencia,
          decoration: const InputDecoration(labelText: 'Referencia para el despacho (opcional)'),
        ),
      ],
    );
  }
}

// "Así llega tu pedido": un envío por proveedor con su modalidad y montos.
class _AsiLlega extends StatelessWidget {
  const _AsiLlega({required this.carro, required this.despacho, required this.retiros, required this.opciones});

  final CarroDetallado carro;
  final int Function(GrupoCarro) despacho;
  final Map<int, int> retiros;
  final OpcionesEntrega opciones;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final totalDespacho = carro.grupos.fold(0, (s, g) => s + despacho(g));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Así llega tu pedido', style: textTheme.titleMedium),
            const SizedBox(height: 10),
            for (final g in carro.grupos)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      retiros.containsKey(g.proveedorId)
                          ? Icons.store_mall_directory_outlined
                          : Icons.local_shipping_outlined,
                      size: 20,
                      color: AppColors.magenta,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g.nombre, style: textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                          Text(
                            [
                              g.lineas.length == 1 ? '1 producto' : '${g.lineas.length} productos',
                              if (g.plazoHoras != null) 'entrega ${formatearPlazo(g.plazoHoras!)}',
                              retiros.containsKey(g.proveedorId)
                                  ? 'retiro sin costo'
                                  : (despacho(g) == 0 ? 'despacho gratis' : 'despacho ${formatearClp(despacho(g))}'),
                            ].join(' · '),
                            style: textTheme.bodySmall?.copyWith(color: AppColors.textoSuave),
                          ),
                        ],
                      ),
                    ),
                    Text(formatearClp(g.subtotal + despacho(g)), style: textTheme.bodyMedium),
                  ],
                ),
              ),
            const Divider(height: 20),
            Row(
              children: [
                const Expanded(child: Text('Productos')),
                Text(formatearClp(carro.subtotal)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Expanded(child: Text('Despachos (estimado)')),
                Text(totalDespacho == 0 ? 'Gratis' : formatearClp(totalDespacho)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BarraPagar extends StatelessWidget {
  const _BarraPagar({required this.total, required this.enviando, required this.onPagar});

  final int total;
  final bool enviando;
  final VoidCallback onPagar;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: enviando ? null : onPagar,
              icon: enviando
                  ? const SizedBox.square(
                      dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.lock_outline_rounded),
              label: Text('Pagar ${formatearClp(total)}'),
            ),
          ),
        ),
      ),
    );
  }
}
