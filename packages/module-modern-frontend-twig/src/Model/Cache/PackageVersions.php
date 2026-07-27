<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Cache;

use Composer\InstalledVersions;

/**
 * Reads the installed package set from Composer's runtime API.
 *
 * A seam over a static call so {@see BuildSignature} can be tested without
 * touching Composer's global state.
 */
class PackageVersions
{
    /**
     * @return array[] One entry per installed.php loaded by Composer.
     */
    public function getAll(): array
    {
        if (!class_exists(InstalledVersions::class)) {
            return [];
        }

        return InstalledVersions::getAllRawData();
    }
}
