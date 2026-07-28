/**
 * Compares an island's markup either side of hydration.
 *
 * A hydration that matched leaves the DOM untouched: Vue compares `class` as a
 * set and `style` as a map, and a difference there only logs. Anything Vue
 * cannot adopt goes through `handleMismatch`, which removes the server node and
 * patches the right one in — so the server markup having changed IS the
 * mismatch, exactly and without fixtures.
 *
 * Pure string work, so the browser side stays in the module's bootstrap and this
 * is unit-testable in Node.
 */

export interface HydrationMismatch {
    /** Index of the first differing character. */
    offset: number;
    /** Excerpt of the server markup around the divergence. */
    server: string;
    /** The same window of the markup Vue ended up with. */
    client: string;
    /** Where the divergence sits inside both excerpts. */
    column: number;
}

const CONTEXT = 60;

/**
 * Back up to the tag the divergence sits in, so an excerpt starts somewhere a
 * reader can orient on instead of mid-attribute.
 */
function tagBoundary(text: string, offset: number, context: number): number {
    const floor = Math.max(0, offset - context);
    const opening = text.lastIndexOf("<", offset);

    return opening >= floor ? opening : floor;
}

export function diffHydration(
    server: string,
    client: string,
    context = CONTEXT,
): HydrationMismatch | null {
    if (server === client) {
        return null;
    }

    const shared = Math.min(server.length, client.length);
    let offset = 0;
    while (offset < shared && server[offset] === client[offset]) {
        offset += 1;
    }

    const start = tagBoundary(server, offset, context);
    const end = offset + context;

    return {
        offset,
        column: offset - start,
        server: server.slice(start, end),
        client: client.slice(start, end),
    };
}

/**
 * Render a mismatch as the aligned three-line block a console shows best.
 */
export function formatMismatch(mismatch: HydrationMismatch, label: string): string {
    const caret = `${" ".repeat("server: ".length + mismatch.column)}^ first difference at offset ${mismatch.offset}`;

    return [
        `[MageObsidian] Island "${label}" hydrated with a mismatch — Vue replaced the server markup.`,
        `server: ${mismatch.server}`,
        `client: ${mismatch.client}`,
        caret,
    ].join("\n");
}
