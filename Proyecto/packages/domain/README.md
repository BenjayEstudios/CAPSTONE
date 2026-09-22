# @cotizapp/domain

Capa de dominio: TypeScript puro, sin dependencias de infraestructura (nada
de Drizzle, MySQL, Fastify). Por eso `apps/web` puede importarlo
directamente sin arrastrar dependencias de servidor.

## Estructura

```
src/
├── entities/       # entidades de dominio (ej. Organizacion, Producto, Oferta, Carro, Orden)
├── dtos/            # DTOs y schemas zod para entrada/salida de casos de uso
└── repositories/     # interfaces de repositorio (puertos), implementadas
                        por @cotizapp/infrastructure
```

Las entidades reflejan el modelo de `DataBase/dbDiagram.sql` (organizacion,
usuario, rol, categoria, producto, oferta, carro, orden, orden_linea,
orden_envio, documento_tributario, liquidacion, etc.) — todavía no
trasladado a código.

## Regla de dependencia

`domain` no depende de ningún otro paquete del monorepo. Todo lo demás
depende de `domain` (directa o indirectamente).
