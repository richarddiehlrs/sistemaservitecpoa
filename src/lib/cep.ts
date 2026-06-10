import { onlyDigits } from "./format";

export type EnderecoViaCep = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

// Consulta endereço pelo CEP usando a API pública ViaCEP.
export async function buscarCep(cepRaw: string): Promise<EnderecoViaCep | null> {
  const cep = onlyDigits(cepRaw);
  if (cep.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.erro) return null;

    return {
      cep: data.cep ?? cepRaw,
      logradouro: data.logradouro ?? "",
      complemento: data.complemento ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
