<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Cache;

/**
 * Identifies the deployed code, so compiled templates from a previous build are
 * never read after an update.
 *
 * Modification times cannot answer this: Composer extracts dist archives keeping
 * the packaged mtimes, so a package installed today can carry files dated weeks
 * ago — older than the cache compiled from its previous version, which makes
 * Twig's `auto_reload` consider them fresh. The installed package set is exact
 * and cheap: it is already in memory, and the result is memoized for the request.
 */
class BuildSignature
{
    /**
     * Used when Composer's runtime API is unavailable, which only happens in
     * artificial setups (a hand-built autoloader). Every build then shares one
     * namespace and invalidation falls back to `cache:flush` / `auto_reload`.
     */
    public const string FALLBACK = 'nocomposer';

    private ?string $signature = null;

    /**
     * @param PackageVersions $packageVersions
     */
    public function __construct(
        private readonly PackageVersions $packageVersions
    ) {
    }

    /**
     * @return string A short hash, safe to use as a directory name.
     */
    public function get(): string
    {
        if ($this->signature !== null) {
            return $this->signature;
        }

        $identity = [];
        foreach ($this->packageVersions->getAll() as $dataSet) {
            foreach ($dataSet['versions'] ?? [] as $package => $info) {
                $identity[$package] = ($info['version'] ?? '') . '@' . ($info['reference'] ?? '');
            }
        }

        if ($identity === []) {
            return $this->signature = self::FALLBACK;
        }

        ksort($identity);

        return $this->signature = hash('xxh128', (string)json_encode($identity));
    }
}
