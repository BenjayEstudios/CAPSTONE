import 'perfil.dart';

class OrganizacionSesion {
  const OrganizacionSesion({required this.id, required this.nombre, required this.tipo});

  final int id;
  final String nombre;
  // cliente | proveedor (enum tipo de la tabla organizacion)
  final String tipo;
}

class UsuarioSesion {
  const UsuarioSesion({
    required this.id,
    required this.nombre,
    required this.email,
    required this.rol,
    required this.organizacion,
  });

  final int id;
  final String nombre;
  final String email;
  final String rol;
  final OrganizacionSesion organizacion;
}

// Usuario autenticado + JWT. perfil decide qué navegación ve.
class Sesion {
  const Sesion({required this.token, required this.perfil, required this.usuario});

  final String token;
  final Perfil perfil;
  final UsuarioSesion usuario;
}
