/** Structured reports are opt-in; mentioning an indicator is not a request. */
export function isExplicitReportRequest(text: string): boolean {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(mostr\w*|exib\w*|ger\w*|apresent\w*|ver|veja|quero|preciso|qual|quais|quanto|relatorio)\b/.test(normalized)
    && /metrica|indicador|kpi|ticket|cmv|margem|lucro|faturamento|receita|compras|vendas|dre|demonstrativo|grafico|chart|pizza|linha|barras|tabela|planilha|extrato|lancamentos|fluxo de caixa/.test(normalized);
}