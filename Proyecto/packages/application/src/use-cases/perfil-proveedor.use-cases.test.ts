import { describe, expect, it } from "vitest";
import type { CambiosPerfilProveedor, ComunaRepository, PerfilProveedor, ProveedorRepository, RegistroAuditoria } from "@cotizapp/domain";
import { actualizarMiPerfilProveedor, enmascararCuenta, miPerfilProveedor } from "./perfil-proveedor.use-cases.js";

const DIR = { calle: "Av. Frei Montalva", numero: "9650", complemento: "Bodega 12", comunaId: 7, comuna: "Quilicura", region: "Metropolitana de Santiago" };
const base = (extra: Partial<PerfilProveedor> = {}): PerfilProveedor => ({
  id: 2, razonSocial: "Distribuidora Los Andes Ltda.", rut: "76543210-3", nombreFantasia: "Los Andes Food Service", giro: "Distribución mayorista",
  emailContacto: "ventas@losandes.test", telefono: "+56 2 2600 4100", direccion: DIR,
  bodega: { id: 1, nombre: "Bodega Quilicura", horario: "Lun a Vie 08:00-17:00", direccion: DIR },
  plazoEstandarHoras: 24, plazoFueraRegionHoras: 72, horaCorte: "14:00", despachoGratisDesde: 150000, ofreceDespacho: true, ofreceRetiro: true,
  banco: "Banco de Chile", cuentaBancaria: "00-002-48213-02", estado: "activa", comisionPct: 8, entregasATiempoPct: 96.5,
  creadaEn: new Date("2026-03-01T00:00:00Z"), regiones: ["Metropolitana de Santiago"], equipo: [{ nombre: "Ventas", email: "ventas@losandes.test", telefono: null }],
  ...extra
});

function montar(perfil: PerfilProveedor | null = base()) {
  const st = { perfil, cambios: [] as CambiosPerfilProveedor[], auditoria: [] as RegistroAuditoria[] };
  const proveedorRepository = {
    perfil: async (id: number) => (id === 2 ? st.perfil : null),
    actualizarPerfil: async (_id: number, c: CambiosPerfilProveedor, a: RegistroAuditoria) => {
      st.cambios.push(c);
      st.auditoria.push(a);
      const { direccion, bodega, ...resto } = c;
      st.perfil = { ...st.perfil!, ...resto };
      if (bodega) st.perfil.bodega = { id: 9, nombre: bodega.nombre, horario: bodega.horario, direccion: { ...DIR, ...bodega } };
      if (direccion) st.perfil.direccion = { ...DIR, ...direccion };
    }
  } as unknown as ProveedorRepository;
  const comunaRepository = { listar: async () => [{ id: 7, nombre: "Quilicura", regionCodigo: "13", regionNombre: "RM" }, { id: 20, nombre: "Ñuñoa", regionCodigo: "13", regionNombre: "RM" }] } as ComunaRepository;
  return { st, deps: { proveedorRepository, comunaRepository } };
}

describe("perfil de empresa del proveedor (KAN-108)", () => {
  it("lee el perfil de la organizacion del token; sin organizacion proveedora -> 403", async () => {
    const { deps } = montar();
    expect((await miPerfilProveedor(deps)(2)).razonSocial).toBe("Distribuidora Los Andes Ltda.");
    await expect(miPerfilProveedor(deps)(6)).rejects.toMatchObject({ statusCode: 403 });
    await expect(miPerfilProveedor(deps)(Number.NaN)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("guarda solo lo que cambio y lo audita con la cuenta enmascarada", async () => {
    const { deps, st } = montar();
    const p = await actualizarMiPerfilProveedor(deps)(4, 2, {
      telefono: "+56 2 2600 4100", horaCorte: "15:30", despachoGratisDesde: 120000, cuentaBancaria: "11-222-33333-44", giro: ""
    });
    expect(st.cambios).toEqual([{ horaCorte: "15:30", despachoGratisDesde: 120000, cuentaBancaria: "11-222-33333-44", giro: null }]);
    expect(st.auditoria[0]).toMatchObject({
      usuarioId: 4, entidad: "organizacion", entidadId: 2, accion: "editar",
      datosAntes: { horaCorte: "14:00", despachoGratisDesde: 150000, cuentaBancaria: "…3-02", giro: "Distribución mayorista" },
      datosDespues: { operacion: "editar_perfil_proveedor", horaCorte: "15:30", cuentaBancaria: "…3-44", giro: null }
    });
    expect(JSON.stringify(st.auditoria)).not.toContain("48213");
    expect(p.horaCorte).toBe("15:30");
  });

  it("sin cambios reales no escribe; razon social y RUT no se editan", async () => {
    const { deps, st } = montar();
    await actualizarMiPerfilProveedor(deps)(4, 2, { nombreFantasia: "Los Andes Food Service" });
    expect(st.cambios).toEqual([]);
    await expect(actualizarMiPerfilProveedor(deps)(4, 2, { razonSocial: "Otra" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(actualizarMiPerfilProveedor(deps)(4, 2, { rut: "1-9" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(actualizarMiPerfilProveedor(deps)(4, 2, {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("direccion y bodega nuevas; la comuna tiene que existir", async () => {
    const { deps, st } = montar();
    await actualizarMiPerfilProveedor(deps)(4, 2, {
      direccion: { calle: "Av. Irarrázaval", numero: "3400", comunaId: 20 },
      bodega: { nombre: "Bodega Ñuñoa", horario: "Lun a Sáb 08:00-14:00", calle: "Pedro de Valdivia", numero: "100", complemento: "", comunaId: 20 }
    });
    expect(st.cambios[0]).toMatchObject({
      direccion: { calle: "Av. Irarrázaval", numero: "3400", complemento: null, comunaId: 20 },
      bodega: { nombre: "Bodega Ñuñoa", horario: "Lun a Sáb 08:00-14:00", calle: "Pedro de Valdivia", complemento: null, comunaId: 20 }
    });
    await expect(actualizarMiPerfilProveedor(deps)(4, 2, { direccion: { calle: "X", comunaId: 999 } })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("despacho o retiro, al menos uno; el retiro exige bodega", async () => {
    const { deps } = montar();
    await expect(actualizarMiPerfilProveedor(deps)(4, 2, { ofreceDespacho: false, ofreceRetiro: false })).rejects.toMatchObject({ statusCode: 409, code: "SIN_MODALIDAD" });
    const sinBodega = montar(base({ bodega: null, ofreceRetiro: false }));
    await expect(actualizarMiPerfilProveedor(sinBodega.deps)(4, 2, { ofreceRetiro: true })).rejects.toMatchObject({ statusCode: 409, code: "RETIRO_SIN_BODEGA" });
    await actualizarMiPerfilProveedor(sinBodega.deps)(4, 2, { ofreceRetiro: true, bodega: { nombre: "Bodega", calle: "Calle 1", comunaId: 7 } });
    expect(sinBodega.st.cambios[0]).toMatchObject({ ofreceRetiro: true, bodega: { nombre: "Bodega", horario: null } });
  });

  it("valida formatos: hora de corte, plazos, correo y cuenta", async () => {
    const { deps } = montar();
    for (const malo of [{ horaCorte: "25:00" }, { plazoEstandarHoras: 0 }, { emailContacto: "no-es-correo" }, { cuentaBancaria: "abc" }, { despachoGratisDesde: -1 }]) {
      await expect(actualizarMiPerfilProveedor(deps)(4, 2, malo)).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it("enmascara la cuenta", () => {
    expect(enmascararCuenta("00-002-48213-02")).toBe("…3-02");
    expect(enmascararCuenta(null)).toBeNull();
  });
});
