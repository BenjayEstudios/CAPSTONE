import { FORM_VACIO, FormProducto, aPayload, faltantesPublicar, mensajeError, mover, validarAncho, validarArchivo, validarBorrador } from "./producto-ficha.util";

const ok: FormProducto = { ...FORM_VACIO, nombre: "Leche", sku: "lec-1", categoriaId: "3", precioReferencia: "1000" };
const principal = [{ url: "http://x/a.jpg", esPrincipal: true }];

describe("producto-ficha.util", () => {
  it("valida borrador y normaliza SKU", () => {
    expect(validarBorrador(ok)).toEqual({});
    expect(aPayload(ok).sku).toBe("LEC-1");
    expect(aPayload(ok).categoriaId).toBe(3);
    expect(Object.keys(validarBorrador({ ...ok, nombre: "", sku: "", ean: "12", categoriaId: "" }))).toEqual(["nombre", "sku", "ean", "categoriaId"]);
  });
  it("tope exige precio de referencia y rango 0-100", () => {
    expect(validarBorrador({ ...ok, precioReferencia: "", topeSobreReferenciaPct: "10" })["topeSobreReferenciaPct"]).toBeTruthy();
    expect(validarBorrador({ ...ok, topeSobreReferenciaPct: "101" })["topeSobreReferenciaPct"]).toBeTruthy();
    expect(validarBorrador({ ...ok, topeSobreReferenciaPct: "0" })).toEqual({});
  });
  it("publicar lista lo que falta", () => {
    expect(faltantesPublicar(ok, principal)).toEqual([]);
    expect(faltantesPublicar({ ...ok, nombre: "", categoriaId: "", precioReferencia: "0" }, [])).toEqual([
      "nombre", "categoria", "precio de referencia mayor a 0", "exactamente 1 imagen principal"
    ]);
    expect(faltantesPublicar(ok, [...principal, { url: "b", esPrincipal: true }]).length).toBe(1);
  });
  it("valida archivo y ancho", () => {
    expect(validarArchivo({ type: "image/gif", size: 1 })).toBeTruthy();
    expect(validarArchivo({ type: "image/png", size: 6 * 1024 * 1024 })).toBeTruthy();
    expect(validarArchivo({ type: "image/jpeg", size: 100 })).toBeNull();
    expect(validarAncho(1199)).toBeTruthy();
    expect(validarAncho(1200)).toBeNull();
  });
  it("mapea errores del servidor", () => {
    const e = (status: number, code?: string, message = "m") => ({ status, error: { error: { code, message } } });
    expect(mensajeError(e(409, "SKU_DUPLICADO"))).toContain("SKU");
    expect(mensajeError(e(400, "PUBLICACION_INCOMPLETA", "falta nombre"))).toContain("falta nombre");
    expect(mensajeError(e(403))).toContain("permiso");
    expect(mensajeError(e(413))).toContain("grande");
  });
  it("reordena y renumera", () => {
    const r = mover([0, 1, 2].map((i) => ({ id: i, orden: i })), 0, 1);
    expect(r.map((x) => x.id)).toEqual([1, 0, 2]);
    expect(r.map((x) => x.orden)).toEqual([0, 1, 2]);
  });
});
