import { vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The contract hash must be stable while the file is unchanged and must change
 * (via the mtime-guarded reload) when the contract is regenerated — this is what
 * lets downstream caches invalidate on a module enable/disable in a long-lived
 * process instead of serving results keyed only by theme.
 */
describe("configResolver contract hash + mtime reload", () => {
    let tmpFile;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        if (tmpFile && fs.existsSync(tmpFile)) {
            fs.rmSync(tmpFile);
        }
    });

    const writeContract = (file, contract, mtimeSeconds) => {
        fs.writeFileSync(file, JSON.stringify(contract));
        fs.utimesSync(file, new Date(mtimeSeconds * 1000), new Date(mtimeSeconds * 1000));
    };

    test("hash stays stable while unchanged and changes after a regeneration", async () => {
        tmpFile = path.join(os.tmpdir(), `obsidian-contract-${process.pid}.json`);
        const base = {
            schema_version: "1.0.0",
            mode: "developer",
            modules: { Vendor_A: { src: "/a" } },
            themes: {},
            allModules: ["Vendor_A"],
            LIB_PATH: "lib",
        };
        writeContract(tmpFile, base, 10000);

        vi.doMock("#config/default.js", () => ({
            __esModule: true,
            DEPENDENCY_CONFIG_FILE_PATH: tmpFile,
            OUTPUT_THEME_DIR: "web/generated",
        }));
        vi.doMock("#core/contractValidator.js", () => ({
            __esModule: true,
            validateContract: () => ({ ok: true, errors: [] }),
        }));

        const configResolver = (await import("#core/configResolver.js")).default;

        const firstHash = configResolver.getContractHash();
        expect(configResolver.getContractHash()).toBe(firstHash); // same mtime → cached

        // Regenerate: a module appears, and mtime advances.
        writeContract(
            tmpFile,
            {
                ...base,
                modules: { Vendor_A: { src: "/a" }, Vendor_B: { src: "/b" } },
                allModules: ["Vendor_A", "Vendor_B"],
            },
            20000,
        );

        expect(configResolver.getContractHash()).not.toBe(firstHash);
        expect(configResolver.getMagentoConfig().allModules).toEqual(["Vendor_A", "Vendor_B"]);
    });
});
