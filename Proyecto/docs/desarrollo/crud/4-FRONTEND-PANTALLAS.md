# CRUD, parte 4: pantallas Angular

Pasos 11 a 13 de la [guía de CRUD](README.md). Viene de
[3-FRONTEND-BASE.md](3-FRONTEND-BASE.md), donde quedan listos el cliente
HTTP, el token y `CategoriasService`.

## Paso 11: rutas y pantallas

> **Por qué así:** la feature es una unidad autocontenida con carga diferida; la validación que vale es la del backend (G, E). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

`categorias.routes.ts`, y se registra lazy en `app.routes.ts`:

```ts
export const CATEGORIAS_ROUTES: Routes = [
  { path: "", component: CategoriasListaComponent },
  { path: "nueva", component: CategoriaFormComponent },
  { path: ":id", component: CategoriaFormComponent }
];

// app.routes.ts
{ path: "categorias", loadChildren: () => import("./features/categorias/categorias.routes").then((m) => m.CATEGORIAS_ROUTES) }
```

**Lista** (`categorias-lista.component.ts`) — carga al crear el componente
y saca la fila al eliminar, sin volver a pedir todo:

```ts
@Component({ selector: "app-categorias-lista", standalone: true, imports: [RouterLink], templateUrl: "./categorias-lista.component.html" })
export class CategoriasListaComponent {
  private readonly service = inject(CategoriasService);
  readonly categorias = signal<Categoria[]>([]);
  readonly error = signal<string | null>(null);

  constructor() {
    this.service.listar().subscribe({
      next: (lista) => this.categorias.set(lista),
      error: (err: HttpErrorResponse) => this.error.set(mensajeDeError(err))
    });
  }

  eliminar(categoria: Categoria) {
    this.service.eliminar(categoria.id).subscribe({
      next: () => this.categorias.update((lista) => lista.filter((c) => c.id !== categoria.id)),
      error: (err: HttpErrorResponse) => this.error.set(mensajeDeError(err))
    });
  }
}
```

```html
@if (error()) { <p class="error">{{ error() }}</p> }
<a routerLink="nueva">Nueva categoría</a>
<table>
  @for (c of categorias(); track c.id) {
    <tr>
      <td>{{ c.nombre }}</td> <td>{{ c.slug }}</td> <td>{{ c.estado }}</td>
      <td><a [routerLink]="[c.id]">Editar</a> <button type="button" (click)="eliminar(c)">Eliminar</button></td>
    </tr>
  } @empty {
    <tr><td colspan="4">No hay categorías.</td></tr>
  }
</table>
```

**Formulario** (`categoria-form.component.ts`) — el mismo componente crea
(`/categorias/nueva`) y edita (`/categorias/:id`):

```ts
@Component({ selector: "app-categoria-form", standalone: true, imports: [ReactiveFormsModule, RouterLink], templateUrl: "./categoria-form.component.html" })
export class CategoriaFormComponent {
  private readonly service = inject(CategoriasService);
  private readonly router = inject(Router);
  protected readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get("id")) || null;

  readonly error = signal<string | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ["", [Validators.required, Validators.maxLength(80)]],
    slug: ["", [Validators.required, Validators.maxLength(80)]],
    estado: ["activa" as Categoria["estado"]]
  });

  constructor() {
    if (this.id) this.service.obtener(this.id).subscribe((c) => this.form.patchValue(c));
  }

  guardar() {
    const input = this.form.getRawValue();
    const peticion = this.id ? this.service.actualizar(this.id, input) : this.service.crear(input);
    peticion.subscribe({
      next: () => this.router.navigate(["/categorias"]),
      error: (err: HttpErrorResponse) => this.error.set(mensajeDeError(err))
    });
  }
}
```

```html
<form [formGroup]="form" (ngSubmit)="guardar()">
  <label>Nombre <input formControlName="nombre" /></label>
  <label>Slug <input formControlName="slug" /></label>
  @if (id) {
    <label>Estado
      <select formControlName="estado">
        <option value="activa">Activa</option>
        <option value="oculta">Oculta</option>
      </select>
    </label>
  }
  @if (error()) { <p class="error">{{ error() }}</p> }
  <button type="submit" [disabled]="form.invalid">Guardar</button>
  <a routerLink="/categorias">Cancelar</a>
</form>
```

- Los validadores del formulario son para ayudar al usuario; la validación
  que vale es la de zod en el backend. El mensaje del 400/409 se muestra tal
  cual con `mensajeDeError`.
- Los colores y estilos van con la paleta de
  [IDENTIDAD-VISUAL.md](../../diseno/IDENTIDAD-VISUAL.md).

## Paso 12: test del servicio

> **Por qué así:** como solo el servicio habla HTTP, basta con interceptar sus requests (G). Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

Mismo patrón que `features/status/status.component.spec.ts`: se intercepta
el HTTP con `HttpTestingController` y se revisa método y URL.

```ts
describe("CategoriasService", () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("eliminar hace DELETE /categorias/:id", () => {
    TestBed.inject(CategoriasService).eliminar(3).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/categorias/3`);
    expect(req.request.method).toBe("DELETE");
    req.flush(null, { status: 204, statusText: "No Content" });
  });
});
```

`pnpm --filter @cotizapp/admin-site test` (ChromeHeadless, igual que en CI).

## Paso 13: probarlo en el navegador

> **Por qué así:** lo que falle acá es de unión entre capas, porque cada una ya se probó sola. Ver [principios](RESUMEN-Y-PORQUE.md#los-principios-de-la-arquitectura).

Con `docker compose up` (o `pnpm dev`): backend en `:8000`, admin-site en
`:4300` (ya está en `CORS_ORIGINS`). Abrir
`http://localhost:4300/categorias`, crear, editar, ocultar y eliminar, y
mirar en la pestaña *Network* del navegador que cada acción sea el request
esperado y que el header `Authorization` vaya en los de escritura.
