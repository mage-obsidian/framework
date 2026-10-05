<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */

declare(strict_types=1);

namespace MageObsidian\Monorepo\Test;

use MageObsidian\Monorepo\PreCommitConfig;
use PHPUnit\Framework\TestCase;

final class PreCommitConfigTest extends TestCase
{
    public function testEveryScopeGetsOneHookPerFileTypeWithItsOwnHeader(): void
    {
        $config = PreCommitConfig::render([
            'packages/a/' => 'packages/a/.license-header.txt',
            'tools/' => '.license-header.txt',
        ]);

        self::assertSame(14, substr_count($config, '- id: insert-license'));
        self::assertStringContainsString("files: '^packages/a/.*\\.php$'", $config);
        self::assertStringContainsString("files: '^tools/.*\\.css$'", $config);
        self::assertStringContainsString('--license-filepath, packages/a/.license-header.txt,', $config);
        self::assertStringContainsString('--license-filepath, .license-header.txt,', $config);
    }

    public function testTheRegexesTheHooksNeedSurviveVerbatim(): void
    {
        $config = PreCommitConfig::render(['packages/a/' => 'packages/a/.license-header.txt']);

        self::assertStringContainsString("--comment-style, '/**| *| */', --insert-license-after-regex, '^<\\?php$'", $config);
        self::assertStringContainsString("--comment-style, '<!--||-->', --insert-license-after-regex, '^<\\?xml.*\\?>$'", $config);
        self::assertStringContainsString("--comment-style, '{#||#}'", $config);
    }

    public function testAPackageExcludeIsAnchoredToItsOwnDirectory(): void
    {
        $config = PreCommitConfig::render(
            ['packages/theme-base/' => 'packages/theme-base/.license-header.txt'],
            ['theme-base' => '(Magento_Theme/templates/root\\.phtml)$'],
        );

        self::assertStringContainsString("|^packages/theme-base/(Magento_Theme/templates/root\\.phtml)$'", $config);
        self::assertStringStartsWith("exclude: '" . PreCommitConfig::EXCLUDE, $config);
    }
}
