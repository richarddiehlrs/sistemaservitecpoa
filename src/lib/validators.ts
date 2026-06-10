import { onlyDigits } from "./format";

export function validarCPF(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i], 10) * (10 - i);
  let d = 11 - (s % 11);
  if (d >= 10) d = 0;
  if (d !== parseInt(c[9], 10)) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i], 10) * (11 - i);
  d = 11 - (s % 11);
  if (d >= 10) d = 0;
  return d === parseInt(c[10], 10);
}

export function validarCNPJ(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: number) => {
    let s = 0;
    let pos = base - 7;
    for (let i = 0; i < base; i++) {
      s += parseInt(c[i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (calc(12) !== parseInt(c[12], 10)) return false;
  return calc(13) === parseInt(c[13], 10);
}

export function validarCpfCnpj(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length === 11) return validarCPF(c);
  if (c.length === 14) return validarCNPJ(c);
  return false;
}
