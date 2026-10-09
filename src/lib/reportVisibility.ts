/** Structured reports are opt-in; mentioning an indicator is not a request. */
export function isExplicitReportRequest(text: string): boolean {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const intent = /\b(mostr\w*|exib\w*|ger\w*|mont\w*|apresent\w*|visualiz\w*|veja|relatorio)\b/.test(normalized)
    || /\b(quero|preciso|posso)\s+(?:de\s+)?(?:ver|visualizar|consultar|receber)\b/.test(normalized)
    || /\b(qual|quais|quanto)\b/.test(normalized);
  const report = /metrica|indicador|kpi|ticket|cmv|margem|lucro|faturamento|receita|compras|vendas|dre|demonstrativo|grafico|chart|pizza|linha|barras|tabela|planilha|extrato|lancamentos|fluxo de caixa/.test(normalized);
  return intent && report;
}