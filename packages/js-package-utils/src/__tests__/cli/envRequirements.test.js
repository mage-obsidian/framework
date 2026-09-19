import { DEV_SERVER_REQUIRED_ENV, missingEnvFor } from "../../cli/envRequirements.ts";

describe("missingEnvFor", () => {
    it("asks nothing of a production build", () => {
        expect(missingEnvFor(false, {})).toEqual([]);
    });

    it("names the dev server settings it cannot infer", () => {
        expect(missingEnvFor(true, {})).toEqual(["VITE_SERVER_HOST", "VITE_SERVER_PORT"]);
    });

    it("accepts a dev server with an empty MAGENTO_HOST and no optional settings", () => {
        expect(missingEnvFor(true, { VITE_SERVER_HOST: "phpfpm", VITE_SERVER_PORT: "5173", MAGENTO_HOST: "" })).toEqual([]);
    });

    it("requires only host and port", () => {
        expect(DEV_SERVER_REQUIRED_ENV).toEqual(["VITE_SERVER_HOST", "VITE_SERVER_PORT"]);
    });
});
