import { vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * The baseline is what the runtime subtracts from, so the only things that
 * matter are that it lands inside the build output and that a store which never
 * ran the export gets an empty list rather than nothing at all — a missing file
 * would read as "unknown" and make the storefront recompile every class it sees.
 */
describe("writeCmsBaseline", () => {
    let workDir;

    beforeEach(async () => {
        vi.resetModules();
        workDir = await fs.mkdtemp(path.join(os.tmpdir(), "cms-baseline-"));
    });

    afterEach(async () => {
        await fs.rm(workDir, { recursive: true, force: true });
    });

    const load = async (cmsContentDir) => {
        const actual = await vi.importActual("#config/default.ts");
        vi.doMock("#config/default.ts", () => ({ ...actual, CMS_CONTENT_DIR: cmsContentDir }));
        vi.doMock("#core/configResolver.ts", () => ({
            __esModule: true,
            default: {
                getThemeDefinition: (name) =>
                    name === "Vendor/known" ? { src: path.join(workDir, "theme") } : undefined,
            },
        }));
        return (await import("#core/cmsBaseline.ts")).writeCmsBaseline;
    };

    test("copies the exported class list into the theme's build output", async () => {
        const cms = path.join(workDir, "cms");
        await fs.mkdir(cms, { recursive: true });
        await fs.writeFile(
            path.join(cms, "candidates.json"),
            '["bg-sheen-violet","md:grid-cols-3"]',
        );

        const writeCmsBaseline = await load(cms);
        const target = await writeCmsBaseline("Vendor/known");

        expect(target).toBe(path.join(workDir, "theme", "web/generated", "cms-candidates.json"));
        expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual([
            "bg-sheen-violet",
            "md:grid-cols-3",
        ]);
    });

    test("writes an empty list when the export was never run", async () => {
        const writeCmsBaseline = await load(path.join(workDir, "never-exported"));
        const target = await writeCmsBaseline("Vendor/known");

        expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual([]);
    });

    test("does nothing for a theme that is not in the contract", async () => {
        const writeCmsBaseline = await load(path.join(workDir, "cms"));

        expect(await writeCmsBaseline("Vendor/unknown")).toBeNull();
    });
});
