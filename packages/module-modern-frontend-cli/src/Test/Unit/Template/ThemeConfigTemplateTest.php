<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Test\Unit\Template;

use PHPUnit\Framework\TestCase;

final class ThemeConfigTemplateTest extends TestCase
{
    private const array ENGINE_KEYS = [
        'includeCssSourceFromParentThemes',
        'ignoredCssFromModules',
        'ignoredTailwindConfigFromModules',
        'exposeNpmPackages',
        'vue',
    ];

    public function testEveryKeyItWritesIsOneTheEngineReads(): void
    {
        $this->assertSame([], array_values(array_diff($this->topLevelKeys(), self::ENGINE_KEYS)));
    }

    public function testItSaysWhetherTheThemeBuildsOnItsParentsCss(): void
    {
        $this->assertContains('includeCssSourceFromParentThemes', $this->topLevelKeys());
    }

    private function topLevelKeys(): array
    {
        $template = (string)file_get_contents(__DIR__ . '/../../../Template/generators/theme/theme.config.js.tpl');
        preg_match_all('/^ {4}([A-Za-z]+)\s*:/m', $template, $matches);

        return $matches[1];
    }
}
