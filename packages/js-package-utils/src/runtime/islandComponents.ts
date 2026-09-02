import type { ComponentLoader } from "./islands.ts";

export type IslandComponentMap = Record<string, ComponentLoader>;

const components: IslandComponentMap = {};

export default components;
