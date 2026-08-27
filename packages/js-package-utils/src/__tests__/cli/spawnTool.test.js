import path from "path";
import { COMMAND_NOT_FOUND, missingCommand, withLocalBin } from "../../cli/spawnTool.ts";

describe("withLocalBin", () => {
    it("puts the harness's own bin ahead of whatever PATH already had", () => {
        const env = withLocalBin({ PATH: "/usr/bin" }, "/var/www/html/vite");
        const [first, ...rest] = env.PATH.split(path.delimiter);

        expect(first).toBe(path.resolve("/var/www/html/vite", "node_modules", ".bin"));
        expect(rest).toEqual(["/usr/bin"]);
    });

    it("survives an environment with no PATH at all", () => {
        const env = withLocalBin({}, "/vite");

        expect(env.PATH).toBe(path.resolve("/vite", "node_modules", ".bin"));
    });

    it("carries the rest of the environment through untouched", () => {
        const env = withLocalBin({ PATH: "/usr/bin", CURRENT_THEME: "Acme/aurora" }, "/vite");

        expect(env.CURRENT_THEME).toBe("Acme/aurora");
    });
});

describe("missingCommand", () => {
    // A missing binary and a theme that does not compile are different problems
    // with different fixes, and 127 is the shell saying it never ran the tool.
    it("names the command and says it never ran", () => {
        const message = missingCommand("vue-tsc --noEmit");

        expect(message).toContain("vue-tsc --noEmit");
        expect(message).toContain("not installed or not on PATH");
        expect(message).toContain(String(COMMAND_NOT_FOUND));
    });
});
