// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import {
    cookiesWork,
    deleteCookie,
    parseSiteConfig,
    requireCookies,
    readSiteConfig,
    serializeCookie,
    writeCookie,
    type SiteConfig,
} from "../../runtime/cookies.ts";

const config = (overrides: Partial<SiteConfig["cookie"]> = {}, websiteId = 1): SiteConfig => ({
    version: 1,
    cookie: {
        domain: ".shop.test",
        path: "/",
        lifetime: 3600,
        secure: true,
        sameSite: "lax",
        ...overrides,
    },
    websiteId,
    noCookiesUrl: "https://shop.test/cookie/index/noCookies/",
});

describe("parseSiteConfig", () => {
    it("reads the published block", () => {
        expect(parseSiteConfig(JSON.stringify(config()))).toEqual(config());
    });

    it("answers null for anything that is not a version 1 block", () => {
        expect(parseSiteConfig(null)).toBeNull();
        expect(parseSiteConfig("")).toBeNull();
        expect(parseSiteConfig("{not json")).toBeNull();
        expect(parseSiteConfig(JSON.stringify({ ...config(), version: 2 }))).toBeNull();
        expect(parseSiteConfig(JSON.stringify({ version: 1 }))).toBeNull();
    });

    it("fills what a partial block leaves out", () => {
        const parsed = parseSiteConfig(
            JSON.stringify({ version: 1, cookie: { domain: ".a.test" }, websiteId: 2 }),
        );

        expect(parsed).toEqual({
            version: 1,
            cookie: { domain: ".a.test", path: "/", lifetime: 0, secure: false, sameSite: "lax" },
            websiteId: 2,
            noCookiesUrl: "",
        });
    });

    it("reads the store view and the currency when the block names them", () => {
        const parsed = parseSiteConfig(
            JSON.stringify({ ...config(), storeId: 3, currency: "EUR" }),
        );

        expect(parsed?.storeId).toBe(3);
        expect(parsed?.currency).toBe("EUR");
    });

    it("leaves the store view and the currency out when the block does not carry them", () => {
        const parsed = parseSiteConfig(JSON.stringify(config()));

        expect(parsed).not.toHaveProperty("storeId");
        expect(parsed).not.toHaveProperty("currency");
    });

    it("ignores a store view or currency of the wrong shape", () => {
        const parsed = parseSiteConfig(JSON.stringify({ ...config(), storeId: "x", currency: 5 }));

        expect(parsed).not.toHaveProperty("storeId");
        expect(parsed).not.toHaveProperty("currency");
    });

    it("keeps the page that explains what to do without cookies", () => {
        expect(parseSiteConfig(JSON.stringify(config()))?.noCookiesUrl).toBe(
            "https://shop.test/cookie/index/noCookies/",
        );
    });
});

describe("readSiteConfig", () => {
    it("takes the block from the document by its id", () => {
        const doc = {
            getElementById: (id: string) =>
                id === "mage-obsidian-site-config"
                    ? { textContent: JSON.stringify(config()) }
                    : null,
        };

        expect(readSiteConfig(doc)).toEqual(config());
    });

    it("answers null when the page published none", () => {
        expect(readSiteConfig({ getElementById: () => null })).toBeNull();
        expect(readSiteConfig(undefined)).toBeNull();
    });
});

describe("serializeCookie", () => {
    it("applies the configured domain, path, Secure and SameSite", () => {
        const text = serializeCookie("form_key", "abc", { config: config({ path: "/shop" }) });

        expect(text).toBe("form_key=abc; path=/shop; domain=.shop.test; secure; samesite=lax");
    });

    it("leaves the domain out when the cookie is host-only", () => {
        expect(serializeCookie("a", "b", { config: config({ domain: "" }) })).not.toContain(
            "domain=",
        );
    });

    it("leaves Secure out when the store does not ask for it", () => {
        expect(serializeCookie("a", "b", { config: config({ secure: false }) })).not.toContain(
            "secure",
        );
    });

    it("adds an expiry when a lifetime is given", () => {
        const text = serializeCookie("a", "b", {
            config: config(),
            maxAgeSeconds: 60,
            now: Date.UTC(2026, 0, 1),
        });

        expect(text).toContain("max-age=60");
        expect(text).toContain("expires=Thu, 01 Jan 2026 00:01:00 GMT");
    });

    it("lets the caller name the path, which is how one cookie is cleared from every path it may sit on", () => {
        expect(
            serializeCookie("a", "b", { config: config({ path: "/shop" }), path: "/shop/x" }),
        ).toContain("path=/shop/x");
    });

    it("falls back to a plain Lax cookie on the root path with no configuration", () => {
        expect(serializeCookie("a", "b", {})).toBe("a=b; path=/; samesite=lax");
    });

    it("lets the caller force Secure when there is no configuration", () => {
        expect(serializeCookie("a", "b", { secure: true })).toContain("; secure");
    });

    it("encodes a value that would break the header", () => {
        expect(serializeCookie("a", "x y;z", {})).toContain("a=x%20y%3Bz");
    });
});

describe("writeCookie and deleteCookie", () => {
    it("writes through the document's cookie setter", () => {
        const written: string[] = [];
        const doc = {
            set cookie(value: string) {
                written.push(value);
            },
        } as unknown as Pick<Document, "cookie">;

        writeCookie("form_key", "abc", { config: config() }, doc);

        expect(written).toEqual(["form_key=abc; path=/; domain=.shop.test; secure; samesite=lax"]);
    });

    it("deletes with the same domain and path, which is the only way the browser matches it", () => {
        const written: string[] = [];
        const doc = {
            set cookie(value: string) {
                written.push(value);
            },
        } as unknown as Pick<Document, "cookie">;

        deleteCookie("mage-messages", { config: config({ path: "/shop" }) }, doc);

        expect(written[0]).toContain("mage-messages=;");
        expect(written[0]).toContain("max-age=0");
        expect(written[0]).toContain("path=/shop");
        expect(written[0]).toContain("domain=.shop.test");
    });

    it("also deletes the variant a server wrote without a domain, which the browser keeps as another cookie", () => {
        const written: string[] = [];
        const doc = {
            set cookie(value: string) {
                written.push(value);
            },
        } as unknown as Pick<Document, "cookie">;

        deleteCookie("mage-messages", { config: config({ path: "/shop" }) }, doc);

        expect(written).toHaveLength(2);
        expect(written[1]).toContain("mage-messages=;");
        expect(written[1]).toContain("path=/shop");
        expect(written[1]).not.toContain("domain=");
    });

    it("writes one deletion when the store configures no domain", () => {
        const written: string[] = [];
        const doc = {
            set cookie(value: string) {
                written.push(value);
            },
        } as unknown as Pick<Document, "cookie">;

        deleteCookie("mage-messages", { config: config({ domain: "" }) }, doc);

        expect(written).toHaveLength(1);
    });

    it("writes a host-only cookie when the caller asks for no domain, as the server does for the session marker", () => {
        const written: string[] = [];
        const doc = {
            set cookie(value: string) {
                written.push(value);
            },
        } as unknown as Pick<Document, "cookie">;

        writeCookie("mage-cache-sessid", "1", { config: config(), domain: "" }, doc);

        expect(written).toEqual(["mage-cache-sessid=1; path=/; secure; samesite=lax"]);
    });
});

const jar = (keepsWrites = true) => {
    const store = new Map<string, string>();
    return {
        store,
        get cookie() {
            return [...store].map(([name, value]) => `${name}=${value}`).join("; ");
        },
        set cookie(text: string) {
            if (!keepsWrites) {
                return;
            }
            const [pair, ...attributes] = text.split("; ");
            const [name, value] = pair.split("=");
            if (attributes.some((attribute) => attribute.startsWith("max-age=0"))) {
                store.delete(name);
                return;
            }
            store.set(name, value);
        },
    };
};

describe("cookiesWork", () => {
    it("is true when the browser keeps a cookie it was given", () => {
        expect(cookiesWork(jar(), { cookieEnabled: true })).toBe(true);
    });

    it("is false when the browser says cookies are off", () => {
        expect(cookiesWork(jar(), { cookieEnabled: false })).toBe(false);
    });

    it("is false when the browser says yes and then drops what it is given", () => {
        expect(cookiesWork(jar(false), { cookieEnabled: true })).toBe(false);
    });

    it("leaves nothing behind", () => {
        const holder = jar();

        cookiesWork(holder, { cookieEnabled: true });

        expect(holder.store.size).toBe(0);
    });
});

describe("requireCookies", () => {
    it("lets the action through when cookies work", () => {
        const visited: string[] = [];

        expect(
            requireCookies({
                jar: jar(),
                nav: { cookieEnabled: true },
                config: config(),
                navigate: (url) => visited.push(url),
            }),
        ).toBe(true);
        expect(visited).toEqual([]);
    });

    it("sends the shopper to the page that explains it when they do not", () => {
        const visited: string[] = [];

        expect(
            requireCookies({
                jar: jar(false),
                nav: { cookieEnabled: true },
                config: config(),
                navigate: (url) => visited.push(url),
            }),
        ).toBe(false);
        expect(visited).toEqual(["https://shop.test/cookie/index/noCookies/"]);
    });

    it("lets the server decide when the page names nowhere to send them", () => {
        const visited: string[] = [];
        const bare = { ...config(), noCookiesUrl: "" };

        expect(
            requireCookies({
                jar: jar(false),
                nav: { cookieEnabled: false },
                config: bare,
                navigate: (url) => visited.push(url),
            }),
        ).toBe(true);
        expect(visited).toEqual([]);
    });
});
