import { vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const THEME = "Vendor/theme-a";

describe("getAllJsVueFilesWithInheritanceCached", () => {
    let dir;
    let mapFile;
    let moduleResolver;

    beforeEach(async () => {
        vi.resetModules();

        dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo-precompiled-"));
        fs.mkdirSync(path.join(dir, ".precompiled", THEME), { recursive: true });
        mapFile = path.join(dir, ".precompiled", THEME, "allJsVueFilesWithInheritance.json");

        vi.doMock("#config/default.ts", async (importOriginal) => ({
            ...(await importOriginal()),
            PRECOMPILED_FOLDER: path.join(dir, ".precompiled"),
        }));
        vi.doMock("#core/configResolver.ts", () => ({
            default: {
                getMagentoConfig: () => ({
                    themes: {},
                    VUE_COMPONENTS_PATH: "components",
                    JS_PATH: "js",
                }),
                getModulesConfigArray: () => [],
                getAllMagentoModulesEnabled: () => [],
                getContractHash: () => "hash",
            },
        }));

        moduleResolver = (await import("#core/moduleResolver.ts")).default;
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    function write(map, mtimeSeconds) {
        fs.writeFileSync(mapFile, JSON.stringify(map));
        const stamp = new Date(mtimeSeconds * 1000);
        fs.utimesSync(mapFile, stamp, stamp);
    }

    test("serves the persisted map", () => {
        write({ "Vendor_Module/js/a": "/abs/a.js" }, 1_700_000_000);

        expect(moduleResolver.getAllJsVueFilesWithInheritanceCached(THEME)).toEqual({
            "Vendor_Module/js/a": "/abs/a.js",
        });
    });

    test("re-reads the map once the file has been rewritten", () => {
        write({ "Vendor_Module/js/a": "/abs/a.js" }, 1_700_000_000);
        moduleResolver.getAllJsVueFilesWithInheritanceCached(THEME);

        write(
            { "Vendor_Module/js/a": "/abs/a.js", "Vendor_Module/js/b": "/abs/b.js" },
            1_700_000_060,
        );

        expect(moduleResolver.getAllJsVueFilesWithInheritanceCached(THEME)).toEqual({
            "Vendor_Module/js/a": "/abs/a.js",
            "Vendor_Module/js/b": "/abs/b.js",
        });
    });

    test("does not re-read while the file is untouched", () => {
        write({ "Vendor_Module/js/a": "/abs/a.js" }, 1_700_000_000);

        const first = moduleResolver.getAllJsVueFilesWithInheritanceCached(THEME);
        const second = moduleResolver.getAllJsVueFilesWithInheritanceCached(THEME);

        expect(second).toBe(first);
    });
});
