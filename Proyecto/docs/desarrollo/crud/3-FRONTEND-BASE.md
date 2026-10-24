# CRUD, parte 3: base del frontend Angular

Pasos 8 a 10 de la [guía de CRUD](README.md). Viene de [2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md).

El ejemplo va en `apps/admin-site` (gestión de categorías es KAN-118).
`apps/ecommerce` tiene la misma estructura (`core/`, `features/`, `shared/`),
así que se hace igual. Angular 18: componentes standalone, signals y el
control flow nuevo (`@if`, `@for`).

```
src/app/
├── core/
│   ├── api/api.client.ts         # (existe, solo get) + post/patch/delete
│   ├── api/errores.ts            # mensajeDeError()
│   ├── auth/auth.interceptor.ts  # agrega el Bearer token
│   └── state/session.state.ts    # (existe) + token
└── features/categorias/
    ├── categoria.model.ts
    ├── categorias.service.ts
    ├── categorias.routes.ts
    ├── categorias-lista.component.{ts,html}
    └── categoria-form.component.{ts,html}
```

## Paso 8: completar ApiClient

> **Por qué así:** es infraestructura del frontend, va en `core/` y es lo único que conoce la URL base (G). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

Hoy solo tiene `get`. Se agregan los otros verbos en
`core/api/api.client.ts`:

```ts
  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }
```

`baseUrl` sale de `environment.apiUrl`: `http://localhost:8000` en
desarrollo y `/api` en producción. Nunca se escribe la URL a mano.

Y un helper para mostrar el error que manda el backend
(`{ error: { code, message } }`), en `core/api/errores.ts`:

```ts
import type { HttpErrorResponse } from "@angular/common/http";

export function mensajeDeError(err: HttpErrorResponse): string {
  return err.error?.error?.message ?? "No se pudo conectar con el servidor";
}
```

## Paso 9: mandar el token (provisorio hasta KAN-144 / KAN-166)

> **Por qué así:** la auth se resuelve una vez en `core/`; ninguna feature se encarga del header (G, C). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

Las rutas de escritura piden `Authorization: Bearer <jwt>`. Mientras no
exista el login, lo mínimo es guardar el token en `SessionState` y que un
interceptor lo agregue:

```ts
// core/state/session.state.ts — se agrega:
  readonly token = signal<string | null>(localStorage.getItem("token"));

// core/auth/auth.interceptor.ts
import type { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { SessionState } from "../state/session.state";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionState).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};

// app.config.ts
provideHttpClient(withInterceptors([authInterceptor]))
```

Para probar: firmar un token como en
[2-BACKEND-RUTAS.md](2-BACKEND-RUTAS.md#paso-7-probar-con-curl), y en la consola del
navegador `localStorage.setItem("token", "<el token>")` y recargar. Cuando
llegue el login, la pantalla de login es la que llena `token`.

## Paso 10: modelo y servicio

> **Por qué así:** el modelo es el contrato con la API y el servicio es lo único de la feature que habla HTTP (F, G). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

`categoria.model.ts` — la misma forma que la entidad de `@cotizapp/domain`.
Ninguna app Angular depende todavía de ese paquete, así que por ahora se
copia el tipo:

```ts
export interface Categoria {
  id: number;
  padreId: number | null;
  nombre: string;
  slug: string;
  orden: number | null;
  estado: "activa" | "oculta";
}

export type CategoriaInput = Partial<Omit<Categoria, "id">>;
```

`categorias.service.ts` — una función por endpoint, nada más. Los
componentes nunca usan `ApiClient` ni `HttpClient` directo:

```ts
@Injectable({ providedIn: "root" })
export class CategoriasService {
  private readonly api = inject(ApiClient);

  listar() { return this.api.get<Categoria[]>("/categorias"); }
  obtener(id: number) { return this.api.get<Categoria>(`/categorias/${id}`); }
  crear(input: CategoriaInput) { return this.api.post<Categoria>("/categorias", input); }
  actualizar(id: number, input: CategoriaInput) { return this.api.patch<Categoria>(`/categorias/${id}`, input); }
  eliminar(id: number) { return this.api.delete<void>(`/categorias/${id}`); }
}
```

Sigue en [4-FRONTEND-PANTALLAS.md](4-FRONTEND-PANTALLAS.md).
