// =============================================================================
// Cálculo de custo/preço da Fábrica 3D — ESPELHO de producao3dCosts.controller.ts
// (mantenha as duas fórmulas idênticas). Usado na Calculadora e na precificação.
// =============================================================================

export const brl = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (v: any): number => {
  const x = parseFloat(String(v ?? "").replace(",", "."));
  return isFinite(x) ? x : 0;
};

export interface Config3D {
  energia_kwh: number | string;
  imposto_perc: number | string;
  margem_perc: number | string;
  mao_obra_hora: number | string;
  perda_perc: number | string;
}

export interface Filament3D {
  id?: string;
  preco_kg: number | string;
  [k: string]: any;
}

export interface Printer3D {
  id?: string;
  valor: number | string;
  vida_horas: number | string;
  potencia_w: number | string;
  manutencao_ano: number | string;
  horas_ano: number | string;
  [k: string]: any;
}

export interface Piece3D {
  filament_grams: number | string; // peso da peça em gramas
  production_minutes: number | string; // tempo de impressão em minutos
  finishing_minutes: number | string; // acabamento em minutos
}

export const computeCost = (
  piece: Partial<Piece3D>,
  filament: Filament3D | null | undefined,
  printer: Printer3D | null | undefined,
  config: Config3D
) => {
  const gramasBase = num(piece?.filament_grams);
  const gramas = gramasBase * (1 + num(config?.perda_perc) / 100);
  const horas = num(piece?.production_minutes) / 60;

  const custoFilamento = filament ? (gramas / 1000) * num(filament.preco_kg) : 0;
  const custoEnergia = printer ? (num(printer.potencia_w) / 1000) * horas * num(config?.energia_kwh) : 0;
  const custoDepreciacao = printer ? (num(printer.valor) / (num(printer.vida_horas) || 1)) * horas : 0;
  const custoManutencao = printer ? (num(printer.manutencao_ano) / (num(printer.horas_ano) || 1)) * horas : 0;
  const custoAcabamento = (num(piece?.finishing_minutes) / 60) * num(config?.mao_obra_hora);

  const custoTotal = custoFilamento + custoEnergia + custoDepreciacao + custoManutencao + custoAcabamento;

  const margem = num(config?.margem_perc) / 100;
  const imposto = num(config?.imposto_perc) / 100;
  const divisor = 1 - margem - imposto;
  const precoVenda = divisor > 0 ? custoTotal / divisor : custoTotal;
  const valorImposto = precoVenda * imposto;
  const lucro = precoVenda - custoTotal - valorImposto;

  return {
    custoFilamento,
    custoEnergia,
    custoDepreciacao,
    custoManutencao,
    custoAcabamento,
    custoTotal,
    precoVenda,
    valorImposto,
    lucro,
    margemReal: precoVenda > 0 ? (lucro / precoVenda) * 100 : 0,
    gramasReais: gramas,
  };
};
