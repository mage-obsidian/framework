<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */

declare(strict_types=1);

namespace MageObsidian\Monorepo\Test;

use MageObsidian\Monorepo\ReleaseGuard;
use PHPUnit\Framework\TestCase;

final class ReleaseGuardTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/release-guard-' . bin2hex(random_bytes(4));
        mkdir($this->root . '/packages', 0777, true);
    }

    protected function tearDown(): void
    {
        exec('rm -rf ' . escapeshellarg($this->root));
    }

    public function testAConsistentTreePasses(): void
    {
        $this->composer('core', 'mage-obsidian/core', ['php' => '>=8.3']);
        $this->composer('cli', 'mage-obsidian/cli', ['mage-obsidian/core' => '^4.1']);
        $this->npm('engine', '4.1.0', null);
        $this->npm('harness', '0.1.0', true);

        self::assertSame([], ReleaseGuard::violations($this->root, '4.1.0'));
    }

    public function testAnInternalDependencyLeftOnTheOldMinorIsReported(): void
    {
        $this->composer('core', 'mage-obsidian/core', []);
        $this->composer('cli', 'mage-obsidian/cli', ['mage-obsidian/core' => '^4.0']);

        self::assertSame(
            ['cli requires mage-obsidian/core ^4.0, expected ^4.1'],
            ReleaseGuard::violations($this->root, '4.1.0'),
        );
    }

    public function testADependencyOnAnotherTrainIsNotChecked(): void
    {
        $this->composer('catalog', 'mage-obsidian/module-catalog', ['mage-obsidian/module-modern-frontend' => '^4.0']);

        self::assertSame([], ReleaseGuard::violations($this->root, '4.3.0'));
    }

    public function testAPublishedNpmPackageOnAnotherVersionIsReported(): void
    {
        $this->npm('engine', '4.0.0', null);

        self::assertSame(
            ['engine is at version 4.0.0, expected 4.1.0'],
            ReleaseGuard::violations($this->root, '4.1.0'),
        );
    }

    public function testABranchAliasOnAnotherMajorIsReported(): void
    {
        $this->composer('core', 'mage-obsidian/core', [], '3.x-dev');

        self::assertSame(
            ['core aliases dev-master to 3.x-dev, expected 4.x-dev'],
            ReleaseGuard::violations($this->root, '4.0.0'),
        );
    }

    public function testATagThatIsNotPlainSemverIsRejected(): void
    {
        self::assertSame(['"v4.1.0" is not a X.Y.Z version'], ReleaseGuard::violations($this->root, 'v4.1.0'));
    }

    private function composer(string $directory, string $name, array $require, string $alias = '4.x-dev'): void
    {
        $this->write($directory . '/composer.json', [
            'name' => $name,
            'require' => $require,
            'extra' => ['branch-alias' => ['dev-master' => $alias]],
        ]);
    }

    private function npm(string $directory, string $version, ?bool $private): void
    {
        $this->write($directory . '/package.json', ['name' => $directory, 'version' => $version, 'private' => $private]);
    }

    private function write(string $relative, array $content): void
    {
        $file = $this->root . '/packages/' . $relative;
        if (!is_dir(dirname($file))) {
            mkdir(dirname($file), 0777, true);
        }
        file_put_contents($file, json_encode($content, JSON_PRETTY_PRINT));
    }
}
