import { describe, expect, it } from "vitest";
import { daysUntilMonthDay } from "./creditCardCycle";

describe("daysUntilMonthDay", () => {
    it("counts within the month, today and into next month", () => {
        expect(daysUntilMonthDay(15, new Date(2026, 9, 10))).toBe(5);
        expect(daysUntilMonthDay(10, new Date(2026, 9, 10))).toBe(0);
        expect(daysUntilMonthDay(5, new Date(2026, 9, 27))).toBe(9);
    });

    it("clamps to the last day of short months", () => {
        expect(daysUntilMonthDay(31, new Date(2026, 1, 20))).toBe(8);
    });
});
