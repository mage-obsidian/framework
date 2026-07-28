import { describe, it, expect } from "vitest";
import { diffHydration, formatMismatch } from "../../runtime/hydrationDiff.ts";

describe("diffHydration", () => {
    it("reports nothing when hydration left the markup alone", () => {
        expect(diffHydration("<p>Hi</p>", "<p>Hi</p>")).toBeNull();
    });

    it("points at the first differing character", () => {
        const mismatch = diffHydration("<p>Hi</p>", "<p>Ho</p>");

        expect(mismatch.offset).toBe(4);
    });

    it("starts the excerpt at the tag the divergence sits in", () => {
        const server = '<div class="a"><span class="chip">x</span></div>';
        const client = '<div class="a"><span class="chip is-on">x</span></div>';

        const mismatch = diffHydration(server, client);

        expect(mismatch.server.startsWith("<span")).toBe(true);
        expect(mismatch.client.startsWith("<span")).toBe(true);
    });

    it("falls back to a fixed window when the tag is further back than the context", () => {
        const filler = "y".repeat(50);
        const mismatch = diffHydration(`<b>${filler}a</b>`, `<b>${filler}z</b>`, 10);

        expect(mismatch.server.startsWith("<")).toBe(false);
        expect(mismatch.column).toBe(10);
    });

    it("lines the column up with the excerpt, not the whole string", () => {
        const server = '<div class="a"><span>x</span></div>';
        const client = '<div class="a"><span>y</span></div>';

        const mismatch = diffHydration(server, client);

        expect(mismatch.server[mismatch.column]).toBe("x");
        expect(mismatch.client[mismatch.column]).toBe("y");
    });

    it("handles a truncated side without running off the end", () => {
        const mismatch = diffHydration("<p>Hi</p>", "<p>");

        expect(mismatch.offset).toBe(3);
        expect(mismatch.client).toBe("<p>");
    });

    it("catches an anchor Vue emitted that the template did not", () => {
        const server = "<div><b>1</b></div>";
        const client = "<div><!--[--><b>1</b><!--]--></div>";

        expect(diffHydration(server, client)).not.toBeNull();
    });
});

describe("formatMismatch", () => {
    it("names the island and aligns the caret under the divergence", () => {
        const mismatch = diffHydration('<span class="a">x</span>', '<span class="a">y</span>');

        const lines = formatMismatch(mismatch, "Vendor_Module::Card").split("\n");

        expect(lines[0]).toContain('Island "Vendor_Module::Card"');
        expect(lines[1].indexOf("<span")).toBe(lines[2].indexOf("<span"));
        expect(lines[3].indexOf("^")).toBe(lines[1].indexOf("x"));
        expect(lines[3]).toContain(`offset ${mismatch.offset}`);
    });
});
