import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "../../../environments/environment";
import { PerfilProveedor } from "../../core/proveedor/panel-proveedor.service";
import { cambiosPerfil, formularioDesde, PerfilProveedorComponent, problemasPerfil } from "./perfil.component";

const API = environment.apiUrl;
const DIR = { calle: "Av. Presidente Eduardo Frei Montalva", numero: "9650", complemento: "Bodega 12", comunaId: 7, comuna: "Quilicura", region: "Metropolitana de Santiago" };
const PERFIL: PerfilProveedor = {
  id: 2, razonSocial: "Distribuidora Los Andes Ltda.", rut: "76543210-3", nombreFantasia: "Los Andes Food Service", giro: "Distribución mayorista de alimentos",
  emailContacto: "ventas@losandes.test", telefono: "+56 2 2600 4100", direccion: DIR,
  bodega: { id: 1, nombre: "Bodega Quilicura", horario: "Lun a Vie 08:00-17:00", direccion: DIR },
  plazoEstandarHoras: 24, plazoFueraRegionHoras: 72, horaCorte: "14:00", despachoGratisDesde: 150000, ofreceDespacho: true, ofreceRetiro: true,
  banco: "Banco de Chile", cuentaBancaria: "00-002-48213-02", estado: "activa", comisionPct: 8, entregasATiempoPct: 96.5,
  creadaEn: "2024-03-10T12:00:00Z", regiones: ["Valparaíso", "Metropolitana de Santiago"], equipo: [{ nombre: "Ventas Los Andes", email: "ventas@losandes.test", telefono: null }]
};
const COMUNAS = [{ id: 7, nombre: "Quilicura", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" }, { id: 20, nombre: "Ñuñoa", regionCodigo: "13", regionNombre: "Metropolitana de Santiago" }];

describe("Perfil de empresa (KAN-108)", () => {
  let ctrl: HttpTestingController;

  async function montar(perfil = PERFIL) {
    TestBed.configureTestingModule({ imports: [PerfilProveedorComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(PerfilProveedorComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/proveedor/perfil`).flush(perfil);
    ctrl.expectOne(`${API}/comunas`).flush(COMUNAS);
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return f;
  }
  const texto = (el: Element) => el.textContent!.replace(/\s+/g, " ").trim();

  it("muestra datos legales (razon social y RUT sin editar), contacto, bodega, despacho y el estado de la cuenta", async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    const inputs = Array.from(el.querySelectorAll<HTMLInputElement>("input.input"));
    expect(inputs[0]!.value).toBe("Distribuidora Los Andes Ltda.");
    expect(inputs[0]!.readOnly).toBeTrue();
    expect(inputs[1]!.value).toBe("76.543.210-3");
    expect(texto(el.querySelector(".equipo")!)).toContain("Ventas Los Andes · ventas@losandes.test");
    expect(Array.from(el.querySelectorAll(".regiones .tag")).map(texto)).toEqual(["Valparaíso", "Metropolitana de Santiago"]);
    const cuenta = texto(el.querySelector(".cuenta")!);
    expect(cuenta).toContain("Verificada");
    expect(cuenta).toContain("marzo de 2024");
    expect(cuenta).toContain("96,5 %");
    expect(cuenta).toContain("8 %");
    expect(cuenta).toContain("Banco de Chile · cta. …3-02");
    expect(cuenta).not.toContain("48213");
    expect((el.querySelector("button[type=submit]") as HTMLButtonElement).disabled).toBeTrue();
  });

  it("guarda solo lo que cambio y muestra el aviso", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.f!.horaCorte = "15:30";
    c.f!.telefono = "";
    c.f!.modalidad = "despacho";
    const p = c.guardar();
    const req = ctrl.expectOne(`${API}/proveedor/perfil`);
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual({ telefono: null, horaCorte: "15:30", ofreceRetiro: false });
    req.flush({ ...PERFIL, telefono: null, horaCorte: "15:30", ofreceRetiro: false });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.ok"))).toContain("Guardamos tu perfil.");
    expect(c.hayCambios()).toBeFalse();
  });

  it("un error 409 del backend se muestra con su mensaje", async () => {
    const f = await montar();
    const c = f.componentInstance;
    c.f!.giro = "Otro giro";
    const p = c.guardar();
    ctrl.expectOne(`${API}/proveedor/perfil`).flush({ error: { code: "RETIRO_SIN_BODEGA", message: "Para ofrecer retiro indica la dirección y el horario de tu bodega" } }, { status: 409, statusText: "x" });
    await p;
    f.detectChanges();
    expect(texto(f.nativeElement.querySelector(".mensaje.error"))).toContain("Para ofrecer retiro indica");
  });

  it("cambiosPerfil: direccion completa si cambio una parte; bodega con nombre y horario", () => {
    const form = formularioDesde(PERFIL);
    expect(cambiosPerfil(PERFIL, form)).toEqual({});
    form.direccion.comunaId = 20;
    form.bodega.horario = "Lun a Sáb 08:00-14:00";
    form.despachoGratisDesde = null;
    expect(cambiosPerfil(PERFIL, form)).toEqual({
      despachoGratisDesde: null,
      direccion: { calle: DIR.calle, numero: "9650", complemento: "Bodega 12", comunaId: 20 },
      bodega: { calle: DIR.calle, numero: "9650", complemento: "Bodega 12", comunaId: 7, nombre: "Bodega Quilicura", horario: "Lun a Sáb 08:00-14:00" }
    });
  });

  it("problemasPerfil: lo que impide guardar", () => {
    const form = formularioDesde(PERFIL);
    expect(problemasPerfil(form, true)).toEqual([]);
    form.nombreFantasia = " ";
    form.emailContacto = "malo";
    form.cuentaBancaria = "abc";
    form.direccion.comunaId = null;
    expect(problemasPerfil(form, true)).toHaveSize(4);
    const sinBodega = formularioDesde({ ...PERFIL, bodega: null, ofreceRetiro: false });
    sinBodega.modalidad = "ambos";
    expect(problemasPerfil(sinBodega, false)).toEqual(["Para ofrecer retiro indica el nombre, la dirección y la comuna de tu bodega."]);
  });
});
