// Árbol de 2 niveles de la tabla categoria: raíces con padreId null.
class Categoria {
  const Categoria({required this.id, required this.padreId, required this.nombre, required this.slug, this.orden});

  final int id;
  final int? padreId;
  final String nombre;
  final String slug;
  final int? orden;

  bool get esRaiz => padreId == null;
}

// Helpers sobre la lista plana que devuelve GET /categorias.
extension ArbolCategorias on List<Categoria> {
  List<Categoria> get raices => where((c) => c.esRaiz).toList()..sort(_porOrden);

  List<Categoria> hijasDe(int id) => where((c) => c.padreId == id).toList()..sort(_porOrden);

  Categoria? porId(int id) {
    for (final c in this) {
      if (c.id == id) return c;
    }
    return null;
  }

  // La raíz de una categoría (ella misma si ya es raíz).
  Categoria? raizDe(int id) {
    final c = porId(id);
    if (c == null || c.esRaiz) return c;
    return porId(c.padreId!);
  }
}

int _porOrden(Categoria a, Categoria b) => (a.orden ?? 0).compareTo(b.orden ?? 0);
