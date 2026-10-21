import { type Metrics } from "./metrics";
import { brl, type Transaction } from "./finliy";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Topic =
  | "faturamento" | "margem" | "lucro" | "dre" | "despesas" | "cmv" | "compras"
  | "saldo" | "ticket" | "produto" | "comparativo" | "impostos" | "marketing"
  | "folha" | "aluguel" | "categoria" | "crescimento" | "numero" | "consultoria"
  | "saudacao" | "agradecimento" | "geral";

function detectTopic(text: string): Topic {
  const t = norm(text);
  if (/(ola|oi|bom dia|boa tarde|boa noite|hey)\b/.test(t)) return "saudacao";
  if (/(obrigad|valeu|agradec|perfeito|otimo|excelente)/.test(t)) return "agradecimento";
  if (/\b(dre)\b|demonstrativo.*resultado|resultado.*liquido/.test(t)) return "dre";
  if (/(dica|conselho|feedback|diagnost|como melhorar|como economizar|reduz|economiz|estrateg|precific|onde.*gast|gastando.*muito|gasto.*alto|melhorar.*margem|o que.*fazer|o que.*acha|opiniao|reflex|meu mes|organiza.*fluxo|planej|controlar.*caixa|recomend)/.test(t)) return "consultoria";
  if (/(quanto.*(gastei|gasto|despesa|paguei)|maior despesa|qual.*maior.*gasto|onde.*estou.*gastando)/.test(t)) return "numero";
  if (/faturamento|receita.*total|receita.*bruta|venda.*total/.test(t)) return "faturamento";
  if (/margem.*lucro|lucro.*liquido|lucro.*bruto|rentabilidade/.test(t)) return "lucro";
  if (/margem\b(?!.*produto)/.test(t)) return "margem";
  if (/margem.*produto|produto.*margem|analise.*margem|margem.*bruta.*produto/.test(t)) return "produto";
  if (/cmv|custo.*mercadoria|custo variavel|custo.*aquisicao/.test(t)) return "cmv";
  if (/compra|fornecedor|estoque|insumo|materia.?prima/.test(t)) return "compras";
  if (/saldo|caixa|fluxo.*caixa|dinheiro.*caixa/.test(t)) return "saldo";
  if (/ticket.*medio|ticket/.test(t)) return "ticket";
  if (/comparativo|comparar|versus|\bvs\b|faturamento.*compra/.test(t)) return "comparativo";
  if (/imposto|tributo|das|simples/.test(t)) return "impostos";
  if (/marketing|anuncio|propaganda|redes.*social/.test(t)) return "marketing";
  if (/folha|salario|funcionario|pessoal/.test(t)) return "folha";
  if (/aluguel|loja|espaco/.test(t)) return "aluguel";
  if (/categoria|tipo.*despesa|gasto.*por/.test(t)) return "categoria";
  if (/crescimento|evolucao|tendencia|aumento|subiu|caiu|variacao/.test(t)) return "crescimento";
  return "geral";
}

function topExpenseCategories(m: Metrics): string {
  const sorted = [...m.despesasPorCategoria].sort((a, b) => b.value - a.value).slice(0, 3);
  return sorted.length ? sorted.map((c, i) => `${i + 1}º ${c.name}: ${brl(c.value)}`).join(" · ") : "Nenhuma despesa registrada.";
}

function productSummary(m: Metrics): string {
  if (!m.produtos.length) return "Ainda não há produtos identificados nos lançamentos.";
  return m.produtos.map((p) => `**${p.produto}** — receita ${brl(p.receita)}, CMV ${brl(p.custo)}, lucro ${brl(p.lucro)}, margem ${m.fmt.pct(p.margem)}`).join("\n");
}

function matchingExpense(text: string, m: Metrics): { name: string; value: number } | undefined {
  const words = norm(text).split(/\s+/).filter((word) => word.length > 3 && !["quanto", "gastei", "gasto", "com", "minha", "meu", "despesa", "qual", "foi", "onde", "estou", "muito"].includes(word));
  return m.despesasPorCategoria.find((expense) => words.some((word) => norm(expense.name).includes(word)));
}

function generalAssessment(m: Metrics): string {
  if (m.resultadoLiquido < 0) return `O período fechou com resultado negativo de **${brl(m.resultadoLiquido)}**. O ponto mais importante agora é proteger o caixa: compare o CMV e a maior despesa antes de assumir novos compromissos.`;
  if (m.margemLiquida < 10) return `O negócio está gerando resultado positivo de **${brl(m.resultadoLiquido)}**, mas a margem líquida de ${m.fmt.pct(m.margemLiquida)} ainda é apertada. Pequenas melhorias no CMV e na maior categoria de despesa podem mudar bastante o resultado.`;
  return `O período apresenta resultado líquido de **${brl(m.resultadoLiquido)}** e margem líquida de ${m.fmt.pct(m.margemLiquida)}. A base parece saudável; o próximo ganho tende a vir do controle de ${m.cmv >= m.despesasOperacionais ? "compras e insumos" : "despesas operacionais"}.`;
}

function consultancy(m: Metrics): string {
  const top = [...m.despesasPorCategoria].sort((a, b) => b.value - a.value)[0];
  const cmvRatio = m.receitaLiquida ? (m.cmv / m.receitaLiquida) * 100 : 0;
  const points: string[] = [];
  if (cmvRatio > 35) points.push(`**Ponto crítico — CMV:** compras e insumos representam ${m.fmt.pct(cmvRatio)} da receita líquida. Renegocie fornecedores, revise fichas técnicas e acompanhe perdas por produto.`);
  if (top) points.push(`**Maior pressão no resultado:** ${top.name} soma ${brl(top.value)}. Defina uma meta de redução ou produtividade para essa categoria, sem cortar despesas essenciais sem medir o impacto.`);
  if (m.margemContribuicao < 50) points.push(`**Precificação e mix:** a margem de contribuição está em ${m.fmt.pct(m.margemContribuicao)}. Priorize itens de maior margem, revise preços e teste combos antes de buscar apenas mais volume.`);
  if (m.margemLiquida < 10) points.push(`**Resultado final:** a margem líquida está em ${m.fmt.pct(m.margemLiquida)}. Separe despesas fixas essenciais, renegociáveis e discricionárias para um plano de redução de 30 dias.`);
  if (!points.length) points.push(`Os indicadores estão equilibrados. Preserve a margem de contribuição de ${m.fmt.pct(m.margemContribuicao)} e monitore CMV, preços e despesas por categoria semanalmente.`);
  return `Analisei os lançamentos atuais e encontrei estes focos de gestão:\n\n${points.map((point, index) => `${index + 1}. ${point}`).join("\n\n")}\n\n**Próximo passo recomendado:** escolha a maior categoria, estabeleça uma meta percentual e compare o resultado no próximo período.`;
}

export function generateLocalResponse(text: string, m: Metrics, txs: Transaction[], demo: boolean): string {
  const topic = detectTopic(text);
  const context = demo ? "Analisando os dados disponíveis na demonstração" : "Analisando seus dados financeiros";

  switch (topic) {
    case "saudacao":
      return "Olá! Sou o assistente financeiro do FINLIY. Como posso ajudar você a entender seus números hoje? Posso investigar despesas, margens, preços, caixa ou preparar uma DRE quando você pedir.";
    case "agradecimento":
      return "Fico feliz em ajudar. Se quiser continuar, posso investigar uma despesa específica, comparar períodos ou sugerir ações para melhorar sua margem.";
    case "consultoria":
      return consultancy(m);
    case "numero": {
      const match = matchingExpense(text, m);
      if (match) return `${context}, você gastou **${brl(match.value)}** com **${match.name}**. Essa categoria representa ${m.receitaBruta ? m.fmt.pct((match.value / m.receitaBruta) * 100) : "0%"} do faturamento.`;
      const largest = [...m.despesasPorCategoria].sort((a, b) => b.value - a.value)[0];
      return largest ? `A maior despesa identificada é **${largest.name}**, com **${brl(largest.value)}**. Ela corresponde a ${m.receitaBruta ? m.fmt.pct((largest.value / m.receitaBruta) * 100) : "0%"} do faturamento.` : "Ainda não encontrei despesas registradas para responder a essa pergunta.";
    }
    case "dre":
      return `${context}, a DRE simplificada apresenta Receita Bruta de **${brl(m.receitaBruta)}**, Deduções de **${brl(m.deducoes)}**, Receita Líquida de **${brl(m.receitaLiquida)}**, CMV de **${brl(m.cmv)}**, Lucro Bruto de **${brl(m.lucroBruto)}**, Despesas Operacionais de **${brl(m.despesasOperacionais)}** e Resultado Líquido de **${brl(m.resultadoLiquido)}**.`;
    case "faturamento":
      return `${context}, o faturamento é **${brl(m.faturamentoTotal)}**, em ${m.vendasCount} vendas, com ticket médio de **${brl(m.ticketMedio)}**.`;
    case "lucro":
      return `${context}, o Lucro Bruto é **${brl(m.lucroBruto)}**, com margem de ${m.fmt.pct(m.margemBruta)}, e o Resultado Líquido é **${brl(m.resultadoLiquido)}**, com margem de ${m.fmt.pct(m.margemLiquida)}.`;
    case "margem":
      return `${context}, a margem bruta está em **${m.fmt.pct(m.margemBruta)}** e a margem líquida em **${m.fmt.pct(m.margemLiquida)}**. A margem de contribuição está em ${m.fmt.pct(m.margemContribuicao)}.`;
    case "produto": {
      const top = m.maiorMargem;
      const low = m.menorMargem;
      return `${context}, estas são as margens por produto:\n\n${productSummary(m)}\n\n${top ? `Melhor margem: **${top.produto}** (${m.fmt.pct(top.margem)}).` : ""}${low && low !== top ? ` Menor margem: **${low.produto}** (${m.fmt.pct(low.margem)}).` : ""}`;
    }
    case "cmv":
      return `${context}, o CMV é **${brl(m.cmv)}**, equivalente a ${m.receitaLiquida ? m.fmt.pct((m.cmv / m.receitaLiquida) * 100) : "0%"} da receita líquida. Esse é o principal indicador para acompanhar custo de insumos e margem bruta.`;
    case "compras":
      return `${context}, as compras totalizam **${brl(m.totalCompras)}** e compõem o CMV. Vale acompanhar o custo por produto e renegociar os itens de maior impacto.`;
    case "despesas":
      return `${context}, as despesas operacionais somam **${brl(m.despesasOperacionais)}**. As maiores categorias são: ${topExpenseCategories(m)}.`;
    case "saldo": {
      const last = m.saldo[m.saldo.length - 1];
      return `${context}, o saldo acumulado mais recente é **${brl(last?.Saldo ?? 0)}**.`;
    }
    case "ticket":
      return `${context}, o ticket médio é **${brl(m.ticketMedio)}**. Combos e ofertas de itens com maior margem podem elevar esse valor sem depender apenas de mais vendas.`;
    case "comparativo":
      return `${context}, o faturamento foi de **${brl(m.receitaBruta)}** contra **${brl(m.cmv)}** em compras, deixando **${brl(m.lucroBruto)}** de lucro bruto. Posso mostrar o comparativo em gráfico se você pedir.`;
    case "impostos": {
      const imp = m.despesasPorCategoria.find((d) => /imposto|tributo|das/i.test(d.name));
      return imp ? `Os impostos identificados somam **${brl(imp.value)}**, equivalentes a ${m.receitaBruta ? m.fmt.pct((imp.value / m.receitaBruta) * 100) : "0%"} do faturamento.` : "Não encontrei lançamentos de impostos nos dados atuais.";
    }
    case "marketing": {
      const marketing = m.despesasPorCategoria.find((d) => /marketing|anuncio/i.test(d.name));
      return marketing ? `Você gastou **${brl(marketing.value)}** com marketing, equivalente a ${m.receitaBruta ? m.fmt.pct((marketing.value / m.receitaBruta) * 100) : "0%"} do faturamento. O custo de aquisição médio por venda é ${brl(m.custoAquisicao)}.` : "Não encontrei gastos de marketing nos dados atuais.";
    }
    case "folha": {
      const folha = m.despesasPorCategoria.find((d) => /folha|salario/i.test(d.name));
      return folha ? `A folha de pagamento soma **${brl(folha.value)}**, representando ${m.receitaBruta ? m.fmt.pct((folha.value / m.receitaBruta) * 100) : "0%"} do faturamento.` : "Não encontrei lançamentos de folha nos dados atuais.";
    }
    case "aluguel": {
      const aluguel = m.despesasPorCategoria.find((d) => /aluguel/i.test(d.name));
      return aluguel ? `O aluguel soma **${brl(aluguel.value)}**, equivalente a ${m.receitaBruta ? m.fmt.pct((aluguel.value / m.receitaBruta) * 100) : "0%"} do faturamento.` : "Não encontrei aluguel nos dados atuais.";
    }
    case "categoria":
      return `${context}, as despesas por categoria são:\n\n${[...m.despesasPorCategoria].sort((a, b) => b.value - a.value).map((category) => `• **${category.name}:** ${brl(category.value)}`).join("\n")}`;
    case "crescimento": {
      const periods = m.porPeriodo.filter((period) => period.Faturamento > 0);
      if (periods.length < 2) return "Ainda não há períodos suficientes com faturamento para identificar uma tendência confiável.";
      const first = periods[0]!.Faturamento;
      const last = periods[periods.length - 1]!.Faturamento;
      const change = first ? ((last - first) / first) * 100 : 0;
      return `Entre o primeiro e o último período com vendas, o faturamento variou **${change >= 0 ? "+" : ""}${change.toFixed(1)}%**: de ${brl(first)} para ${brl(last)}.`;
    }
    default:
      return generalAssessment(m);
  }
}
