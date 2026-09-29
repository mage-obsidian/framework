// This file is part of the MageObsidian - ModernFrontend project.
//
// SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
// SPDX-License-Identifier: MIT
import type { ComponentLoader } from "./islands.ts";

export type IslandComponentMap = Record<string, ComponentLoader>;

const components: IslandComponentMap = {};

export default components;
