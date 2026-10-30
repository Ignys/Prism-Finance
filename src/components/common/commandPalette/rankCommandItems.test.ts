import { describe, expect, it } from "vitest";
import { rankCommandItems } from "./rankCommandItems";

describe("rankCommandItems", () => {
    const items = [
        { label: "Mercado Livre", keywords: "compras" },
        { label: "Supermercado", keywords: "" },
        { label: "Aluguel", keywords: "mercado imobiliário" },
        { label: "Faturas", keywords: "cartão" },
    ];

    it("prioriza prefixo, depois trecho do rótulo, depois palavras-chave, ignorando acentos", () => {
        expect(rankCommandItems(items, "MERCADO", 10).map((item) => item.label)).toEqual(["Mercado Livre", "Supermercado", "Aluguel"]);
        expect(rankCommandItems(items, "cartao", 10).map((item) => item.label)).toEqual(["Faturas"]);
    });

    it("respeita o limite e devolve o início da lista sem busca", () => {
        expect(rankCommandItems(items, "", 2)).toHaveLength(2);
        expect(rankCommandItems(items, "mercado", 1)[0].label).toBe("Mercado Livre");
    });
});
