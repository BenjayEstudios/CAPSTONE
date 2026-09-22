# @cotizapp/application

Casos de uso: funciones puras que reciben sus dependencias (repositorios,
servicios) **como parámetro explícito**, no vía service-locator ni contenedor
de DI. Esto las hace testeables sin mockear estado global.

## Estructura

```
src/use-cases/
└── <feature>/          # ej. catalogo/, carro/, checkout/, pagos/
    ├── comparar-ofertas.ts
    └── agregar-al-carro.ts
```

## Convención

```ts
export function agregarAlCarro(deps: { carroRepository: CarroRepository }) {
  return async (input: AddCarroLineaDto) => {
    return deps.carroRepository.addLinea(input);
  };
}
```

Quien arma `deps` (con la implementación real del repositorio) es el
composition root de `apps/rest` (`src/server/app.ts`), no este paquete.

## Dependencias

Depende solo de `@cotizapp/domain` (entidades, DTOs, interfaces de
repositorio). Nunca depende de `@cotizapp/infrastructure`.
