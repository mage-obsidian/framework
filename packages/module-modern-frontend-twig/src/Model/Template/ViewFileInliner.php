<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use LogicException;
use Magento\Framework\Filesystem\Driver\File;
use Magento\Framework\View\Asset\Repository;
use Throwable;

/**
 * Reads a static view file through the theme fallback and returns its contents.
 */
class ViewFileInliner
{
    /** @var array<string, string> */
    private array $cache = [];

    /**
     * @param Repository $assetRepository
     * @param File $filesystem
     */
    public function __construct(
        private readonly Repository $assetRepository,
        private readonly File $filesystem
    ) {
    }

    /**
     * @param string $fileId A view file reference, e.g. "Vendor_Module::css/x.css".
     *
     * @return string
     * @throws LogicException When the file cannot be resolved or read.
     */
    public function inline(string $fileId): string
    {
        if (isset($this->cache[$fileId])) {
            return $this->cache[$fileId];
        }

        try {
            $source = $this->assetRepository->createAsset($fileId)->getSourceFile();
            $contents = $this->filesystem->fileGetContents($source);
        } catch (Throwable $e) {
            throw new LogicException(
                sprintf('The "inline_view_file" Twig helper could not read "%s".', $fileId),
                0,
                $e
            );
        }

        return $this->cache[$fileId] = $contents;
    }
}
