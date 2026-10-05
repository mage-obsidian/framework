<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */

declare(strict_types=1);

namespace MageObsidian\Monorepo;

final class ReleaseGuard
{
    public static function violations(string $root, string $version): array
    {
        if (preg_match('/^(\d+)\.(\d+)\.\d+$/', $version, $parts) !== 1) {
            return [sprintf('"%s" is not a X.Y.Z version', $version)];
        }

        $constraint = sprintf('^%s.%s', $parts[1], $parts[2]);
        $alias = sprintf('%s.x-dev', $parts[1]);
        $manifests = self::manifests($root, 'composer.json');
        $internal = array_column($manifests, 'name');
        $violations = [];

        foreach ($manifests as $directory => $manifest) {
            foreach (['require', 'require-dev'] as $section) {
                foreach ($manifest[$section] ?? [] as $dependency => $required) {
                    if (in_array($dependency, $internal, true) && $required !== $constraint) {
                        $violations[] = sprintf('%s requires %s %s, expected %s', $directory, $dependency, $required, $constraint);
                    }
                }
            }
            $branchAlias = $manifest['extra']['branch-alias']['dev-master'] ?? 'nothing';
            if ($branchAlias !== $alias) {
                $violations[] = sprintf('%s aliases dev-master to %s, expected %s', $directory, $branchAlias, $alias);
            }
        }

        foreach (self::manifests($root, 'package.json') as $directory => $package) {
            if (($package['private'] ?? false) === true) {
                continue;
            }
            if (($package['version'] ?? 'none') !== $version) {
                $violations[] = sprintf('%s is at version %s, expected %s', $directory, $package['version'] ?? 'none', $version);
            }
        }

        return $violations;
    }

    private static function manifests(string $root, string $file): array
    {
        $manifests = [];
        foreach (glob(sprintf('%s/packages/*/%s', $root, $file)) ?: [] as $path) {
            $manifests[basename(dirname($path))] = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        }
        ksort($manifests);

        return $manifests;
    }
}
