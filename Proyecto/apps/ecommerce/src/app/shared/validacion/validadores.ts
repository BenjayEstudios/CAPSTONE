import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

// Mismas reglas que el backend (packages/domain/src/dtos/cuenta.dto.ts), para
// avisar antes de enviar. El backend vuelve a validar.

/** "12.345.678-5", "12345678-5" o "123456785" -> "12345678-5"; null si el digito verificador no calza. */
export function normalizarRut(valor: string): string | null {
  const limpio = valor.replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === esperado ? `${cuerpo}-${dv}` : null;
}

/** "123456785" -> "12.345.678-5" mientras se escribe (si ya es valido). */
export function formatearRut(valor: string): string {
  const rut = normalizarRut(valor);
  if (!rut) return valor;
  const [cuerpo, dv] = rut.split("-");
  return `${cuerpo!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

export const rutValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  !c.value || normalizarRut(String(c.value)) ? null : { rut: true };

/** 8 a 72 caracteres con al menos una letra y un numero. */
export const claveValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? "");
  if (!v) return null;
  if (v.length < 8) return { clave: "Usa al menos 8 caracteres." };
  if (v.length > 72) return { clave: "Usa como máximo 72 caracteres." };
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return { clave: "Combina letras y números." };
  return null;
};

/** Para el grupo: `confirmar` debe ser igual a `clave`. */
export const clavesIgualesValidator: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const clave = g.get("clave")?.value;
  const confirmar = g.get("confirmar")?.value;
  return confirmar && clave !== confirmar ? { clavesDistintas: true } : null;
};
