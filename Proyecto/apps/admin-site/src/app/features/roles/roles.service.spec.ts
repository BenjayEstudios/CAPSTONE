import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { RolMatriz } from "../../core/models/roles.models";
import { RolesService } from "./roles.service";
import {
  aplicarCambio, celdaBloqueada, estaModificada, mensajeErrorRoles, nivelActual, permisosAEnviar, rolesModificados, totalCambios
} from "./roles.util";

const base = environment.apiUrl;

const rol = (id: number, codigo: string, permisos: RolMatriz["permisos"]): RolMatriz => ({
  id, codigo, nombre: codigo, descripcion: null, esSistema: true, permisos, usuariosAfectados: 1,
  permisosActualizadoPor: null, permisosActualizadoEn: null
});

describe("RolesService", () => {
  let svc: RolesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(RolesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it("lista roles y catalogo", () => {
    svc.listar().subscribe();
    const req = http.expectOne(`${base}/roles`);
    expect(req.request.method).toBe("GET");
    req.flush({ roles: [], catalogo: [] });
  });

  it("actualiza permisos con PUT y body { permisos }", () => {
    svc.actualizarPermisos(3, { crear_producto: "total" }).subscribe();
    const req = http.expectOne(`${base}/roles/3/permisos`);
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toEqual({ permisos: { crear_producto: "total" } });
    req.flush({ id: 3, permisos: {}, cambiado: true });
  });

  it("refresca la sesion con GET /auth/me", () => {
    svc.sesionActual().subscribe();
    const req = http.expectOne(`${base}/auth/me`);
    expect(req.request.method).toBe("GET");
    req.flush({});
  });
});

describe("roles.util (cambios pendientes)", () => {
  const a = rol(1, "administrador", { cambiar_permisos: "total", crear_producto: "total" });
  const e = rol(2, "editor", { crear_producto: "parcial" });

  it("nivel por defecto es ninguno y respeta ediciones", () => {
    expect(nivelActual(e, {}, "ver_auditoria")).toBe("ninguno");
    const c = aplicarCambio({}, e, "crear_producto", "total");
    expect(nivelActual(e, c, "crear_producto")).toBe("total");
    expect(estaModificada(c, 2, "crear_producto")).toBeTrue();
  });

  it("volver al valor original descarta el cambio y no muta", () => {
    const c1 = aplicarCambio({}, e, "crear_producto", "total");
    const c2 = aplicarCambio(c1, e, "crear_producto", "parcial");
    expect(totalCambios(c1)).toBe(1);
    expect(totalCambios(c2)).toBe(0);
    expect(c2).toEqual({});
  });

  it("cuenta cambios y detecta roles modificados", () => {
    let c = aplicarCambio({}, e, "crear_producto", "total");
    c = aplicarCambio(c, e, "ver_auditoria", "parcial");
    c = aplicarCambio(c, a, "crear_producto", "ninguno");
    expect(totalCambios(c)).toBe(3);
    expect(rolesModificados([a, e], c).map((r) => r.id)).toEqual([1, 2]);
    expect(rolesModificados([a, e], aplicarCambio({}, e, "ver_auditoria", "total")).map((r) => r.id)).toEqual([2]);
  });

  it("arma la matriz completa a enviar", () => {
    const c = aplicarCambio({}, e, "ver_auditoria", "total");
    expect(permisosAEnviar(e, c)).toEqual({ crear_producto: "parcial", ver_auditoria: "total" });
  });

  it("bloquea cambiar_permisos solo del administrador", () => {
    expect(celdaBloqueada(a, "cambiar_permisos")).toBeTrue();
    expect(celdaBloqueada(a, "crear_producto")).toBeFalse();
    expect(celdaBloqueada(e, "cambiar_permisos")).toBeFalse();
  });

  it("mensajes de error en español", () => {
    const err = (status: number, code: string, message = "") => ({ status, error: { error: { code, message } } });
    expect(mensajeErrorRoles(err(409, "BLOQUEO_ADMIN"))).toContain("administrador");
    expect(mensajeErrorRoles(err(409, "BLOQUEO_AUTOEDICION"))).toContain("ti mismo");
    expect(mensajeErrorRoles(err(500, "X", "boom"))).toBe("boom");
    expect(mensajeErrorRoles({ status: 0 })).toContain("conexión");
  });
});
