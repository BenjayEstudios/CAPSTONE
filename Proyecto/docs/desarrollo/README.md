# Desarrollo

Lo que hace falta para trabajar en el proyecto y no se deduce del código:
cuentas de prueba, datos sembrados, comandos que se usan poco y se olvidan.

| Archivo | Qué contiene |
|---|---|
| [CUENTAS-DE-PRUEBA.md](CUENTAS-DE-PRUEBA.md) | Usuarios del seed, para qué sirve cada uno y qué datos de demo hay |
| [OPERAR-LA-BASE.md](OPERAR-LA-BASE.md) | Migraciones, seed, particiones mensuales, tests de repositorios y lo que no hay que hacer |

Lo que ya está en otro README no se repite acá:

- Levantar el entorno (Docker o local), hot-reload, agregar una feature,
  proteger una ruta → [README del proyecto](../../README.md).
- Despliegue, CI, operar el droplet, probar producción en local, permisos
  del compose → [infra/README.md](../../infra/README.md).
- Correr la app mobile y el recorrido de la demo →
  [apps/mobile/README.md](../../apps/mobile/README.md).
- Flujo de ramas → [README de la raíz del repo](../../../README.md).

No va acá la arquitectura ni el plan: eso vive en
[arquitectura/](../arquitectura/README.md) y [epicas/](../epicas/README.md).
