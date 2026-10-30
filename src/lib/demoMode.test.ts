import { describe, expect, it } from "vitest";
import { scrambleMoneyText } from "./demoMode";

describe("scrambleMoneyText", () => {
    it("embaralha valores monetários de forma determinística e preserva o formato", () => {
        const input = "Saldo: R$\u00a01.234,56 em 30/10/2026";
        const output = scrambleMoneyText(input);

        expect(output).not.toBe(input);
        expect(output).toMatch(/^Saldo: R\$\u00a0[1-9]\.\d{3},\d{2} em 30\/10\/2026$/);
        expect(scrambleMoneyText(input)).toBe(output);
        expect(scrambleMoneyText("12 transações")).toBe("12 transações");
        expect(scrambleMoneyText("1234.56", "R$ ")).toMatch(/^[1-9]\d{3}\.\d{2}$/);
        expect(scrambleMoneyText("1234.56", "R$ ")).not.toBe("1234.56");
    });
});
