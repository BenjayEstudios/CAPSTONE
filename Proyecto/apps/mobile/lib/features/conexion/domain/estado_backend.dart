// Resultado de GET /health-check: si apps/backend respondió y su hora.
class EstadoBackend {
  const EstadoBackend({required this.ok, this.horaServidor});

  final bool ok;
  final DateTime? horaServidor;
}
