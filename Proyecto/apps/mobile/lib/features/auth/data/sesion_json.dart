import '../../../core/error/failure.dart';
import '../domain/perfil.dart';
import '../domain/sesion.dart';

// Mapeo entre la respuesta de /auth/login y la entidad Sesion. Es también
// el formato en que se guarda la sesión en el dispositivo.
Sesion sesionDesdeJson(Map<String, dynamic> json) {
  final usuario = json['usuario'] as Map<String, dynamic>;
  final organizacion = usuario['organizacion'] as Map<String, dynamic>;
  final rol = usuario['rol'] as String;

  final perfil = Perfil.desdeRol(rol);
  if (perfil == null) {
    throw const ForbiddenFailure(
      'Esta app es para compradores y distribuidores. El equipo Cotizapp usa el panel de administración.',
    );
  }

  return Sesion(
    token: json['token'] as String,
    perfil: perfil,
    usuario: UsuarioSesion(
      id: usuario['id'] as int,
      nombre: usuario['nombre'] as String,
      email: usuario['email'] as String,
      rol: rol,
      organizacion: OrganizacionSesion(
        id: organizacion['id'] as int,
        nombre: organizacion['nombre'] as String,
        tipo: organizacion['tipo'] as String,
      ),
    ),
  );
}

Map<String, dynamic> sesionAJson(Sesion sesion) => {
      'token': sesion.token,
      'usuario': {
        'id': sesion.usuario.id,
        'nombre': sesion.usuario.nombre,
        'email': sesion.usuario.email,
        'rol': sesion.usuario.rol,
        'organizacion': {
          'id': sesion.usuario.organizacion.id,
          'nombre': sesion.usuario.organizacion.nombre,
          'tipo': sesion.usuario.organizacion.tipo,
        },
      },
    };
