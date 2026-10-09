/// <reference types="bun" />
import { expect, test } from "bun:test";
import { isExplicitReportRequest } from "./reportVisibility";

test("metrics require an explicit request", () => {
  expect(isExplicitReportRequest("Mostre minhas métricas")).toBe(true);
  expect(isExplicitReportRequest("Quero ver minhas métricas")).toBe(true);
  expect(isExplicitReportRequest("Quero melhorar minha margem")).toBe(false);
  expect(isExplicitReportRequest("Minha margem está baixa")).toBe(false);
  expect(isExplicitReportRequest("Mostre opções de embalagem")).toBe(false);
});
test("DRE and charts require an explicit request rather than a transaction or upload", () => {
  expect(isExplicitReportRequest("Gere o DRE")).toBe(true);
  expect(isExplicitReportRequest("Exiba o gráfico de vendas")).toBe(true);
  expect(isExplicitReportRequest("me mostra o DRE")).toBe(true);
  expect(isExplicitReportRequest("gera o gráfico de faturamento")).toBe(true);
  expect(isExplicitReportRequest("quero ver a tabela de vendas")).toBe(true);
  expect(isExplicitReportRequest("comprei 300 em estoque")).toBe(false);
  expect(isExplicitReportRequest("📎 financeiro.csv")).toBe(false);
});