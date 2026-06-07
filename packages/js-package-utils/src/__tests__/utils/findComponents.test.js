import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import getFilesFromFolders from "#utils/findComponents.ts";

// Co-located component unit tests (Component.test.js next to Component.vue) must
// not be picked up as build entries — otherwise test-only deps like
// @vue/test-utils leak into the production bundle. Discovery is driven by the
// extensions each folder declares (`directory.ext`), so `.ts` sources are first
// class alongside `.vue`/`.js`.
describe("findComponents", () => {
    let moduleDir;

    beforeAll(() => {
        moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), "mo-find-"));
        const componentsDir = path.join(moduleDir, "components", "elements");
        fs.mkdirSync(componentsDir, { recursive: true });
        fs.writeFileSync(path.join(componentsDir, "Drawer.vue"), "<template><div /></template>");
        fs.writeFileSync(path.join(componentsDir, "helper.js"), "export default {};");
        fs.writeFileSync(path.join(componentsDir, "useWidget.ts"), "export const x: number = 1;");
        fs.writeFileSync(path.join(componentsDir, "Drawer.test.js"), "// co-located unit test");
        fs.writeFileSync(path.join(componentsDir, "Drawer.spec.js"), "// co-located spec");
    });

    afterAll(() => fs.rmSync(moduleDir, { recursive: true, force: true }));

    it("collects .vue/.js/.ts components but skips co-located test and spec files", async () => {
        const result = await getFilesFromFolders("Vendor_Mod", moduleDir, [
            { src: "components", ext: ["vue", "ts", "js"] },
        ]);
        const keys = Object.keys(result);

        expect(keys.some((key) => key.endsWith("/Drawer"))).toBe(true);
        expect(keys.some((key) => key.endsWith("/helper"))).toBe(true);
        expect(keys.some((key) => key.endsWith("/useWidget"))).toBe(true);
        expect(keys.join("|")).not.toMatch(/Drawer\.test/);
        expect(keys.join("|")).not.toMatch(/Drawer\.spec/);
    });

    it("only matches the declared extensions", async () => {
        const result = await getFilesFromFolders("Vendor_Mod", moduleDir, [
            { src: "components", ext: ["vue"] },
        ]);
        const keys = Object.keys(result);

        expect(keys.some((key) => key.endsWith("/Drawer"))).toBe(true);
        expect(keys.some((key) => key.endsWith("/helper"))).toBe(false);
        expect(keys.some((key) => key.endsWith("/useWidget"))).toBe(false);
    });

    it("throws when the same name exists in two extensions in one folder", async () => {
        const dupDir = fs.mkdtempSync(path.join(os.tmpdir(), "mo-dup-"));
        const folder = path.join(dupDir, "js");
        fs.mkdirSync(folder, { recursive: true });
        // A half-finished `.js`→`.ts` rename: keys are extension-less, so both map
        // to the same key and must surface as a hard error, not a silent winner.
        fs.writeFileSync(path.join(folder, "thing.js"), "export default {};");
        fs.writeFileSync(path.join(folder, "thing.ts"), "export default {};");

        await expect(
            getFilesFromFolders("Vendor_Mod", dupDir, [{ src: "js", ext: ["ts", "js"] }]),
        ).rejects.toThrow(/Duplicate file names/);

        fs.rmSync(dupDir, { recursive: true, force: true });
    });
});
