import { InjectionToken } from "@angular/core";

/** La fecha de hoy. Un token para que los tests la fijen antes de crear el componente. */
export const RELOJ = new InjectionToken<() => Date>("RELOJ", { providedIn: "root", factory: () => () => new Date() });
