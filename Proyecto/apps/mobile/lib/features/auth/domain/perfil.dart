// Los dos perfiles que atiende la app. El resto de los roles del sistema
// (admin_general, editor_catalogo, soporte) usan apps/admin-site.
enum Perfil {
  comprador('Comprador'),
  proveedor('Distribuidor');

  const Perfil(this.etiqueta);
  final String etiqueta;

  // rol = codigo de la tabla rol (claim "rol" del JWT).
  static Perfil? desdeRol(String rol) => switch (rol) {
        'comprador' => Perfil.comprador,
        'proveedor' => Perfil.proveedor,
        _ => null,
      };
}
