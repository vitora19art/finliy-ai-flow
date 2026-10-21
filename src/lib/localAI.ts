import { type Metrics } from "./metrics";
import { brl, fmtDate, type Transaction } from "./finliy";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Topic =
  | "faturamento" | "margem" | "lucro" | "dre" | "despesas"
  | "cmv" | "compras" | "saldo" | "ticket" | "produto"
  | "comparativo" | "caixa" | "impostos" | "marketing"
  | "folha" | "aluguel" | "categoria" | "crescimento"
  | "sugestao" | "consultoria" | "saudacao" | "agradecimento" | "geral";

function detectTopic(text: string): Topic {
  const t = norm(text);
  if (/(ola|oi|bom dia|boa tarde|boa noite|hey|ola)/.test(t)) return "saudacao";
  if (/(obrigad|valeu|agradec|perfeito|otimo|excelente)/.test(t)) return "agradecimento";
  if (/\bdre\b|demonstrativo.*resultado|resultado.*liquido/.test(t)) return "dre";
  if (/faturamento|receita.*total|receita.*bruta|venda.*total/.test(t)) return "faturamento";
  if (/margem.*lucro|lucro.*liquido|lucro.*bruto|rentabilidade/.test(t)) return "lucro";
  if (/margem\b(?!.*produto)/.test(t)) return "margem";
  if (/margem.*produto|produto.*margem|analise.*margem|margem.*bruta.*produto/.test(t)) return "produto";
  if (/cmv|custo.*mercadoria|custo variavel|custo.*aquisicao/.test(t)) return "cmv";
  if (/compra|fornecedor|estoque|insumo|materia.?prima/.test(t)) return "compras";
  if (/despesa|gasto|custo operacional/.test(t)) return "despesas";
  if (/saldo|caixa|fluxo.*caixa|dinheiro.*caixa/.test(t)) return "saldo";
  if (/ticket.*medio|ticket/.test(t)) return "ticket";
  if (/comparativo|comparar|versus|\bvs\b|\bx\b|faturamento.*compra/.test(t)) return "comparativo";
  if (/imposto|tributo|das|simples/.test(t)) return "impostos";
  if (/marketing|anuncio|propaganda|redes.*social/.test(t)) return "marketing";
  if (/folha|salario|funcionario|pessoal/.test(t)) return "folha";
  if (/aluguel|loja|espaco/.test(t)) return "aluguel";
  if (/categoria|tipo.*despesa|onde.*gastei|gasto.*por/.test(t)) return "categoria";
  if (/crescimento|evolucao|tendencia|aumento|subiu|caiu|variacao/.test(t)) return "crescimento";
  if (/analise|consultoria|resumo executivo|como melhorar|melhorar a margem/.test(t)) return "consultoria";
  if (/sugest|recomend|conselho|dica|o que.*fazer|melhorar|acao/.test(t)) return "sugestao";
  return "geral";
}

function topExpenseCategories(m: Metrics): string {
  const sorted = [...m.despesasPorCategoria].sort((a, b) => b.value - a.value).slice(0, 3);
  if (!sorted.length) return "Sem despesas registradas.";
  return sorted.map((c, i) => `${i + 1}º ${c.name}: ${brl(c.value)}`).join(" · ");
}

function productSummary(m: Metrics): string {
  if (!m.produtos.length) return "Não há produtos cadastrados ainda.";
  return m.produtos.map((p) =>
    `**${p.produto}** — Receita: ${brl(p.receita)}, CMV: ${brl(p.custo)}, Lucro: ${brl(p.lucro)}, Margem: ${m.fmt.pct(p.margem)}`
  ).join("\n");
}

export function generateLocalResponse(text: string, m: Metrics, txs: Transaction[], demo: boolean): string {
  const topic = detectTopic(text);
  const prefix = demo ? "Com base nos dados de demonstração da Cafeteria Aurora" : "Com base nos seus dados financeiros";

  switch (topic) {
    case "saudacao":
      return "Olá! 👋 Sou o **FINLIY**, seu assistente financeiro. Posso analisar seu faturamento, margens, DRE, despesas e muito mais. Experimente clicar nos atalhos abaixo (DRE, Gráficos de Despesas, Análise de Margem) ou pergunte qualquer coisa sobre suas finanças!";

    case "agradecimento":
      return "De nada! Estou aqui para ajudar sempre que precisar. Que tal ver a **DRE simplificada** ou os **gráficos de despesas**? Use os atalhos abaixo para acessar rapidamente.";

    case "dre":
      return `${prefix}, este é o resumo da sua **DRE Simplificada**:\n\n• **Receita Bruta:** ${brl(m.receitaBruta)}\n• **(-) Deduções:** ${brl(m.deducoes)}\n• **(=) Receita Líquida:** ${brl(m.receitaLiquida)}\n• **(-) Custos / CMV:** ${brl(m.cmv)}\n• **(=) Lucro Bruto:** ${brl(m.lucroBruto)}\n• **(-) Despesas Operacionais:** ${brl(m.despesasOperacionais)}\n• **(=) Resultado Líquido:** ${brl(m.resultadoLiquido)}\n\nA **margem bruta** é de ${m.fmt.pct(m.margemBruta)} e a **margem líquida** de ${m.fmt.pct(m.margemLiquida)}. Para ver a tabela completa, peça **DRE robusta** ou use o atalho de DRE.`;

    case "faturamento":
      return `${prefix}, seu **faturamento total** é de **${brl(m.faturamentoTotal)}**, distribuído em **${m.vendasCount} vendas/recebimentos**, com um **ticket médio** de ${brl(m.ticketMedio)}.\n\nQuer ver o faturamento em gráfico? Clique em **Gráficos de Despesas** ou peça "mostre o gráfico de faturamento".`;

    case "lucro":
      return `${prefix}:\n\n• **Lucro Bruto:** ${brl(m.lucroBruto)} (margem bruta de ${m.fmt.pct(m.margemBruta)})\n• **Resultado Líquido:** ${brl(m.resultadoLiquido)} (margem líquida de ${m.fmt.pct(m.margemLiquida)})\n\nO lucro bruto representa o que sobra após deduzir o CMV. O resultado líquido já considera todas as despesas operacionais. Para o detalhamento completo, clique em **DRE Simplificada**.`;

    case "margem":
      return `${prefix}, sua **margem bruta** é de **${m.fmt.pct(m.margemBruta)}** e a **margem líquida** de **${m.fmt.pct(m.margemLiquida)}**.\n\nA margem bruta mostra quanto sobra de cada real após o custo das mercadorias. A margem líquida considera também as despesas operacionais. Quer ver a margem por produto? Clique em **Análise de Margem**.`;

    case "produto": {
      const top = m.maiorMargem;
      const low = m.menorMargem;
      return `${prefix}, aqui está a análise de margem por produto:\n\n${productSummary(m)}\n\n${top ? `Melhor margem: **${top.produto}** (${m.fmt.pct(top.margem)}).` : ""}${low && low !== top ? ` Pior margem: **${low.produto}** (${m.fmt.pct(low.margem)}).` : ""}\n\nPara ver o gráfico completo, clique em **Análise de Margem** nos atalhos.`;
    }

    case "cmv":
      return `${prefix}, seu **CMV (Custo das Mercadorias Vendidas)** é de **${brl(m.cmv)}**, representando ${m.receitaBruta ? m.fmt.pct((m.cmv / m.receitaBruta) * 100) : "—"} da receita bruta.\n\nIsso significa que ${m.receitaBruta ? m.fmt.pct(m.margemBruta) : "—"} de cada real vendido sobra como lucro bruto antes das despesas operacionais.`;

    case "compras":
      return `${prefix}, o **total de compras** (matéria-prima/insumos) é de **${brl(m.totalCompras)}**.\n\nEsses valores compõem o seu CMV e impactam diretamente a margem bruta. Use o atalho **Análise de Margem** para ver quanto cada produto custa versus quanto gera.`;

    case "despesas":
      return `${prefix}, suas **despesas operacionais** totalizam **${brl(m.despesasOperacionais)}**.\n\nPrincipais categorias: ${topExpenseCategories(m)}\n\nPara ver a distribuição completa em gráfico de pizza, clique em **Gráficos de Despesas** nos atalhos.`;

    case "saldo": {
      const last = m.saldo[m.saldo.length - 1];
      return `${prefix}, seu **saldo de caixa atual** é de **${last ? brl(last.Saldo) : brl(0)}**.\n\nO saldo acumula todas as entradas e saídas registradas. Para ver a evolução do saldo ao longo do tempo, peça "mostre o gráfico de evolução do saldo".`;
    }

    case "ticket":
      return `${prefix}, seu **ticket médio** é de **${brl(m.ticketMedio)}**, calculado sobre ${m.vendasCount} vendas/recebimentos.\n\nUm ticket médio mais alto geralmente indica maior valor agregado por venda. Para melhorar, considere combos ou upsell de produtos com maior margem.`;

    case "comparativo":
      return `${prefix}, comparando faturamento e compras:\n\n• **Faturamento:** ${brl(m.receitaBruta)}\n• **Compras (CMV):** ${brl(m.cmv)}\n• **Diferença (lucro bruto):** ${brl(m.lucroBruto)}\n\nO faturamento é ${m.cmv ? `${(m.receitaBruta / m.cmv).toFixed(1)}x maior` : "infinitamente maior"} que o custo das mercadorias. Peça "mostre o gráfico comparativo" para visualizar as barras lado a lado.`;

    case "impostos": {
      const imp = m.despesasPorCategoria.find((d) => /imposto|tributo|das/i.test(d.name));
      return `${prefix}, ${imp ? `seus impostos totalizam **${brl(imp.value)}** (${m.fmt.pct((imp.value / m.receitaBruta) * 100)} da receita).` : "não há lançamentos de impostos identificados nos dados atuais."}\n\nOs impostos impactam diretamente o resultado líquido da DRE.`;
    }

    case "marketing": {
      const mkt = m.despesasPorCategoria.find((d) => /marketing|anuncio/i.test(d.name));
      return `${prefix}, ${mkt ? `seus gastos com marketing totalizam **${brl(mkt.value)}**, representando ${m.fmt.pct((mkt.value / m.receitaBruta) * 100)} do faturamento.` : "não há gastos de marketing identificados."}\n\nO custo de aquisição por venda é de ${brl(m.custoAquisicao)}. Avalie se o retorno desse investimento está gerando vendas proporcionais.`;
    }

    case "folha": {
      const folha = m.despesasPorCategoria.find((d) => /folha|salario/i.test(d.name));
      return `${prefix}, ${folha ? `a folha de pagamento totaliza **${brl(folha.value)}**, sendo ${m.fmt.pct((folha.value / m.receitaBruta) * 100)} do faturamento.` : "não há lançamentos de folha identificados."}\n\nA folha geralmente é uma das maiores despesas fixas. Monitore essa relação para manter a saúde financeira.`;
    }

    case "aluguel": {
      const aluguel = m.despesasPorCategoria.find((d) => /aluguel/i.test(d.name));
      return `${prefix}, ${aluguel ? `o aluguel totaliza **${brl(aluguel.value)}** mensais (${m.fmt.pct((aluguel.value / m.receitaBruta) * 100)} do faturamento).` : "não há aluguel identificado nos dados."}\n\nCompare esse percentual com o padrão do seu segmento — geralmente recomenda-se manter entre 5% e 10% do faturamento.`;
    }

    case "categoria":
      return `${prefix}, suas despesas por categoria:\n\n${[...m.despesasPorCategoria].sort((a, b) => b.value - a.value).map((c) => `• **${c.name}:** ${brl(c.value)}`).join("\n")}\n\nPara visualizar isso em gráfico de pizza, clique em **Gráficos de Despesas** nos atalhos.`;

    case "crescimento": {
      const periods = m.porPeriodo.filter((p) => p.Faturamento > 0);
      if (periods.length < 2) return `${prefix}, não há períodos suficientes para analisar tendência. Continue registrando lançamentos para acompanhar a evolução.`;
      const first = periods[0]!.Faturamento;
      const last = periods[periods.length - 1]!.Faturamento;
      const change = first ? ((last - first) / first) * 100 : 0;
      const direction = change >= 0 ? "crescimento" : "queda";
      return `${prefix}, comparando o primeiro e o último período com vendas:\n\n• Primeiro período: ${brl(first)}\n• Último período: ${brl(last)}\n• Variação: **${change >= 0 ? "+" : ""}${change.toFixed(1)}%** (${direction})\n\nPara ver a evolução visual, peça "mostre o gráfico de evolução do saldo" ou "gráfico de faturamento".`;
    }

    case "consultoria": {
      const topExpense = [...m.despesasPorCategoria].sort((a, b) => b.value - a.value)[0];
      const cmvRatio = m.receitaLiquida ? (m.cmv / m.receitaLiquida) * 100 : 0;
      const advice: string[] = [];
      if (cmvRatio > 35) advice.push(`O CMV representa ${m.fmt.pct(cmvRatio)} da receita líquida. Priorize renegociação com fornecedores, ficha técnica e redução de perdas antes de aumentar volume.`);
      if (m.margemContribuicao < 50) advice.push(`A margem de contribuição está em ${m.fmt.pct(m.margemContribuicao)}. Uma meta inicial é recuperar pontos por meio de preço, mix de produtos e venda de itens com maior margem.`);
      if (topExpense) advice.push(`A maior despesa é **${topExpense.name}**, com ${brl(topExpense.value)}. Defina uma meta de redução ou produtividade para essa linha e acompanhe mensalmente.`);
      if (m.margemLiquida < 10) advice.push(`A margem líquida de ${m.fmt.pct(m.margemLiquida)} exige disciplina sobre despesas fixas. Separe custos essenciais, renegociáveis e discricionários para um plano de 30 dias.`);
      if (!advice.length) advice.push(`Os indicadores estão equilibrados. Preserve a margem de contribuição em ${m.fmt.pct(m.margemContribuicao)} e monitore o CMV e as despesas por categoria toda semana.`);
      return `${prefix}, aqui está uma análise executiva baseada nos lançamentos atuais:\n\n${advice.map((item, index) => `${index + 1}. ${item}`).join("\n\n")}\n\n**Leitura-chave:** Receita líquida de ${brl(m.receitaLiquida)}, lucro bruto de ${brl(m.lucroBruto)} e EBITDA de ${brl(m.ebitda)}. O próximo foco deve ser transformar a melhoria de margem em uma meta mensurável por categoria.`;
    }

    case "sugestao": {
      const sug: string[] = [];
      if (m.margemBruta < 40) sug.push(`Sua margem bruta (${m.fmt.pct(m.margemBruta)}) está abaixo de 40% — considere renegociar preços com fornecedores ou reajustar seus preços de venda.`);
      if (m.margemLiquida < 10) sug.push(`A margem líquida (${m.fmt.pct(m.margemLiquida)}) é baixa — analise onde é possível reduzir despesas operacionais.`);
      if (m.produtos.length > 1) {
        const low = m.menorMargem;
        if (low && low.margem < 20) sug.push(`O produto **${low.produto}** tem a menor margem (${m.fmt.pct(low.margem)}) — avalie se vale a pena mantê-lo ou ajustar seu preço.`);
      }
      const top = [...m.despesasPorCategoria].sort((a, b) => b.value - a.value)[0];
      if (top) sug.push(`Sua maior despesa é **${top.name}** (${brl(top.value)}) — monitore essa categoria de perto.`);
      if (!sug.length) sug.push("Seus indicadores estão saudáveis! Continue monitorando regularmente.");
      return `${prefix}, aqui estão algumas sugestões:\n\n${sug.map((s) => `• ${s}`).join("\n")}\n\nUse os atalhos **DRE Simplificada**, **Gráficos de Despesas** e **Análise de Margem** para acompanhar tudo visualmente.`;
    }

    default: {
      const lastTx = txs.filter((t) => t.type === "Despesa").slice(-3);
      return `${prefix}, aqui está um panorama financeiro rápido:\n\n📊 **Faturamento:** ${brl(m.faturamentoTotal)}\n💰 **Lucro Bruto:** ${brl(m.lucroBruto)} (${m.fmt.pct(m.margemBruta)})\n📉 **Despesas Operacionais:** ${brl(m.despesasOperacionais)}\n🏦 **Resultado Líquido:** ${brl(m.resultadoLiquido)} (${m.fmt.pct(m.margemLiquida)})\n${lastTx.length ? `\nÚltimos lançamentos:\n${lastTx.map((t) => `• ${fmtDate(t.date)} — ${t.description}: ${brl(t.amount)}`).join("\n")}` : ""}\n\nPara análises visuais, use os atalhos abaixo:\n• **📋 DRE Simplificada** — tabela completa de resultados\n• **📊 Gráficos de Despesas** — distribuição por categoria\n• **💰 Análise de Margem** — margem bruta por produto`;
    }
  }
}
