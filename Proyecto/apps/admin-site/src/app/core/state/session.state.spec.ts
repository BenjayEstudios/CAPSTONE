import { TestBed } from "@angular/core/testing";
import { UsuarioSesion } from "../models/auth.models";
import { SessionState, TOKEN_STORAGE_KEY } from "./session.state";

const usuario = (permisos: UsuarioSesion["permisos"] = {}, rol = "administrador"): UsuarioSesion => ({
  id: "1",
  nombre: "Admin",
  email: "a@b.cl",
  organizacionId: "o1",
  rol,
  permisos
});

describe("SessionState", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("parte vacia sin token", () => {
    const s = TestBed.inject(SessionState);
    expect(s.token()).toBeNull();
    expect(s.autenticado()).toBeFalse();
  });

  it("lee el token persistido al crearse", () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "abc");
    expect(TestBed.inject(SessionState).token()).toBe("abc");
  });

  it("iniciar guarda token y usuario; limpiar los borra", () => {
    const s = TestBed.inject(SessionState);
    s.iniciar("tok", usuario());
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("tok");
    expect(s.autenticado()).toBeTrue();
    expect(s.esAdministrador()).toBeTrue();
    s.limpiar();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(s.autenticado()).toBeFalse();
  });

  it("tienePermiso solo acepta parcial o total", () => {
    const s = TestBed.inject(SessionState);
    s.iniciar("t", usuario({ a: "total", b: "parcial", c: "ninguno" }));
    expect(s.tienePermiso("a")).toBeTrue();
    expect(s.tienePermiso("b")).toBeTrue();
    expect(s.tienePermiso("c")).toBeFalse();
    expect(s.tienePermiso("inexistente")).toBeFalse();
  });

  it("no falla si localStorage lanza", () => {
    spyOn(Storage.prototype, "getItem").and.throwError("bloqueado");
    spyOn(Storage.prototype, "setItem").and.throwError("bloqueado");
    const s = TestBed.inject(SessionState);
    expect(s.token()).toBeNull();
    expect(() => s.iniciar("t", usuario())).not.toThrow();
    expect(s.autenticado()).toBeTrue();
  });
});
