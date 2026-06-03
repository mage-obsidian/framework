import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import getFilesFromFolders from "#utils/findComponents.ts";

// Co-located component unit tests (Component.test.js next to Component.vue) must
// not be picked up as build entries — otherwise test-only deps like
// @vue/test-utils leak into the production bundle.
describe("findComponents", () => {
    let moduleDir;

    beforeAll(() => {
        moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), "mo-find-"));
        const componentsDir = path.join(moduleDir, "components", "elements");
        fs.mkdirSync(componentsDir, { recursive: true });
        fs.writeFileSync(path.join(componentsDir, "Drawer.vue"), "<template><div /></template>");
        fs.writeFileSync(path.join(componentsDir, "helper.js"), "export default {};");
        fs.writeFileSync(path.join(componentsDir, "Drawer.test.js"), "// co-located unit test");
        fs.writeFileSync(path.join(componentsDir, "Drawer.spec.js"), "// co-located spec");
    });

    afterAll(() => fs.rmSync(moduleDir, { recursive: true, force: true }));

    it("collects components but skips co-located test and spec files", async () => {
        const result = await getFilesFromFolders("Vendor_Mod", moduleDir, [
            { src: "components", ext: [] },
        ]);
        const keys = Object.keys(result);

        expect(keys.some((key) => key.endsWith("/Drawer"))).toBe(true);
        expect(keys.some((key) => key.endsWith("/helper"))).toBe(true);
        expect(keys.join("|")).not.toMatch(/Drawer\.test/);
        expect(keys.join("|")).not.toMatch(/Drawer\.spec/);
    });
});
