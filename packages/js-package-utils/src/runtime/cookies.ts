// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
export const SITE_CONFIG_ELEMENT_ID = "mage-obsidian-site-config";

export interface SiteCookieConfig {
    domain: string;
    path: string;
    lifetime: number;
    secure: boolean;
    sameSite: string;
}

export interface SiteConfig {
    version: 1;
    cookie: SiteCookieConfig;
    websiteId: number;
    storeId?: number;
    currency?: string;
    noCookiesUrl: string;
}

export interface CookieOptions {
    config?: SiteConfig | null;
    maxAgeSeconds?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: string;
    now?: number;
}

type ConfigSource = { getElementById(id: string): { textContent: string | null } | null };
type CookieJar = Pick<Document, "cookie">;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export function parseSiteConfig(raw: string | null | undefined): SiteConfig | null {
    if (typeof raw !== "string" || raw === "") {
        return null;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.cookie)) {
        return null;
    }
    const cookie = parsed.cookie;
    const lifetime = Number(cookie.lifetime);
    const websiteId = Number(parsed.websiteId);
    const storeId = parsed.storeId;
    const currency = parsed.currency;
    return {
        version: 1,
        cookie: {
            domain: typeof cookie.domain === "string" ? cookie.domain : "",
            path: typeof cookie.path === "string" && cookie.path !== "" ? cookie.path : "/",
            lifetime: Number.isFinite(lifetime) && lifetime > 0 ? lifetime : 0,
            secure: cookie.secure === true,
            sameSite: typeof cookie.sameSite === "string" && cookie.sameSite !== "" ? cookie.sameSite : "lax",
        },
        websiteId: Number.isFinite(websiteId) ? websiteId : 0,
        ...(typeof storeId === "number" && Number.isFinite(storeId) ? { storeId } : {}),
        ...(typeof currency === "string" && currency !== "" ? { currency } : {}),
        noCookiesUrl: typeof parsed.noCookiesUrl === "string" ? parsed.noCookiesUrl : "",
    };
}

let published: SiteConfig | null | undefined;

export function readSiteConfig(
    source: ConfigSource | undefined = typeof document !== "undefined" ? document : undefined,
): SiteConfig | null {
    if (!source) {
        return null;
    }
    return parseSiteConfig(source.getElementById(SITE_CONFIG_ELEMENT_ID)?.textContent);
}

export function siteConfig(): SiteConfig | null {
    if (published === undefined) {
        published = readSiteConfig();
    }
    return published;
}

export function resetSiteConfig(): void {
    published = undefined;
}

const attributes = (options: CookieOptions): string[] => {
    const cookie = options.config?.cookie;
    const parts = [`path=${options.path ?? cookie?.path ?? "/"}`];
    const domain = options.domain ?? cookie?.domain;
    if (domain) {
        parts.push(`domain=${domain}`);
    }
    if (options.secure ?? cookie?.secure ?? false) {
        parts.push("secure");
    }
    parts.push(`samesite=${options.sameSite ?? cookie?.sameSite ?? "lax"}`);
    return parts;
};

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
    const head = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAgeSeconds !== undefined) {
        const now = options.now ?? Date.now();
        head.push(`max-age=${options.maxAgeSeconds}`);
        head.push(`expires=${new Date(now + options.maxAgeSeconds * 1000).toUTCString()}`);
    }
    return [...head, ...attributes(options)].join("; ");
}

export function writeCookie(
    name: string,
    value: string,
    options: CookieOptions = {},
    jar: CookieJar | undefined = typeof document !== "undefined" ? document : undefined,
): void {
    if (!jar) {
        return;
    }
    jar.cookie = serializeCookie(name, value, { config: siteConfig(), ...options });
}

export function deleteCookie(
    name: string,
    options: CookieOptions = {},
    jar: CookieJar | undefined = typeof document !== "undefined" ? document : undefined,
): void {
    if (!jar) {
        return;
    }
    const merged = { config: siteConfig(), ...options };
    const expire = (target: CookieOptions): void => {
        jar.cookie = [`${name}=`, "max-age=0", "expires=Thu, 01 Jan 1970 00:00:00 GMT", ...attributes(target)].join("; ");
    };
    expire(merged);
    if (merged.config?.cookie?.domain) {
        expire({ ...merged, config: { ...merged.config, cookie: { ...merged.config.cookie, domain: "" } } });
    }
}

const PROBE = "mage-obsidian-cookie-probe";

export function cookiesWork(
    jar: CookieJar | undefined = typeof document !== "undefined" ? document : undefined,
    nav: Pick<Navigator, "cookieEnabled"> | undefined = typeof navigator !== "undefined" ? navigator : undefined,
): boolean {
    if (!jar || nav?.cookieEnabled === false) {
        return false;
    }
    jar.cookie = `${PROBE}=1; path=/; samesite=lax`;
    const kept = jar.cookie.split(";").some((pair) => pair.trim().startsWith(`${PROBE}=`));
    jar.cookie = `${PROBE}=; max-age=0; path=/; samesite=lax`;
    return kept;
}

export interface RequireCookiesDeps {
    jar?: CookieJar;
    nav?: Pick<Navigator, "cookieEnabled">;
    config?: SiteConfig | null;
    navigate?: (url: string) => void;
}

export function requireCookies(deps: RequireCookiesDeps = {}): boolean {
    if (cookiesWork(deps.jar, deps.nav)) {
        return true;
    }
    const url = (deps.config === undefined ? siteConfig() : deps.config)?.noCookiesUrl ?? "";
    if (url === "") {
        return true;
    }
    (deps.navigate ?? ((target: string) => window.location.assign(target)))(url);
    return false;
}
