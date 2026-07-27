<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Cache;

use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Filesystem;
use Magento\Framework\Filesystem\Directory\WriteInterface;

/**
 * Owns the on-disk location of the compiled Twig templates.
 *
 * Every build gets its own subdirectory under `var/cache/twig`, so a deploy can
 * never read what a previous one compiled (see {@see BuildSignature}). The whole
 * tree is wiped whenever the `twig_templates` cache type is cleaned or the cache
 * is flushed, and disabling that type turns compilation caching off entirely —
 * useful when a template appears stuck.
 */
class CompiledTemplateCache
{
    public const string BASE_PATH = 'cache/twig';

    /**
     * @param Filesystem $filesystem
     * @param BuildSignature $buildSignature
     * @param CacheTypeState $cacheTypeState
     */
    public function __construct(
        private readonly Filesystem $filesystem,
        private readonly BuildSignature $buildSignature,
        private readonly CacheTypeState $cacheTypeState
    ) {
    }

    /**
     * @return string|false Absolute path, or false when caching is disabled.
     */
    public function getDirectory(): string|false
    {
        if (!$this->cacheTypeState->isCompilationCacheEnabled()) {
            return false;
        }

        $var = $this->varDirectory();
        $path = self::BASE_PATH . '/' . $this->buildSignature->get();

        if (!$var->isExist($path)) {
            $this->pruneOtherBuilds($path);
            $var->create($path);
        }

        return $var->getAbsolutePath($path);
    }

    /**
     * @return void
     * @throws FileSystemException When the directory exists but cannot be removed.
     */
    public function clear(): void
    {
        $var = $this->varDirectory();
        if ($var->isExist(self::BASE_PATH)) {
            $var->delete(self::BASE_PATH);
        }
    }

    /**
     * @param string $current
     *
     * @return void
     */
    private function pruneOtherBuilds(string $current): void
    {
        $var = $this->varDirectory();
        if (!$var->isExist(self::BASE_PATH)) {
            return;
        }

        foreach ($var->search('*', self::BASE_PATH) as $path) {
            $path = rtrim($path, '/');
            if ($path === $current) {
                continue;
            }
            try {
                $var->delete($path);
            } catch (FileSystemException) {
                // Leftover bytes from an older build are inert once the signature
                // changed; failing to reclaim them must not break rendering.
            }
        }
    }

    /**
     * @return WriteInterface
     */
    private function varDirectory(): WriteInterface
    {
        return $this->filesystem->getDirectoryWrite(DirectoryList::VAR_DIR);
    }
}
