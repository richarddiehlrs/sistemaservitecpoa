import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EMPRESA = {
  nome: process.env.NEXT_PUBLIC_EMPRESA_NOME || "ServitecPoa Assistência Técnica",
  cnpj: process.env.NEXT_PUBLIC_EMPRESA_CNPJ || "",
  telefone: process.env.NEXT_PUBLIC_EMPRESA_TELEFONE || "",
  email: process.env.NEXT_PUBLIC_EMPRESA_EMAIL || "",
  endereco: process.env.NEXT_PUBLIC_EMPRESA_ENDERECO || "",
};
