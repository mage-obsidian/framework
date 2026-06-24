import { selectThemeForDevServer } from "../../cli/selectTheme.ts";

const THEMES = ["MageObsidian/theme-base", "MageObsidian/default"];

describe("selectThemeForDevServer", () => {
    it("returns the explicit theme without prompting", () => {
        let prompted = false;
        const result = selectThemeForDevServer("Acme/aurora", THEMES, true, () => {
            prompted = true;
            return 0;
        });
        expect(result).toBe("Acme/aurora");
        expect(prompted).toBe(false);
    });

    it("prompts and returns the picked theme on an interactive terminal", () => {
        const result = selectThemeForDevServer(undefined, THEMES, true, (themes) => {
            expect(themes).toEqual(THEMES);
            return 1;
        });
        expect(result).toBe("MageObsidian/default");
    });

    it("returns null when the operator cancels the picker", () => {
        const result = selectThemeForDevServer(undefined, THEMES, true, () => -1);
        expect(result).toBeNull();
    });

    it("returns null without prompting when non-interactive", () => {
        let prompted = false;
        const result = selectThemeForDevServer(undefined, THEMES, false, () => {
            prompted = true;
            return 0;
        });
        expect(result).toBeNull();
        expect(prompted).toBe(false);
    });

    it("returns null when there are no themes to pick from", () => {
        const result = selectThemeForDevServer(undefined, [], true, () => 0);
        expect(result).toBeNull();
    });
});
