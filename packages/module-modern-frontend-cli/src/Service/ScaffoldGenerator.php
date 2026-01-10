<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Service;

use Magento\Framework\Component\ComponentRegistrar;
use Magento\Framework\Component\ComponentRegistrarInterface;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Filesystem\Driver\File;

/**
 * Renders scaffolding templates and writes generated files. Templates live in
 * this module's `Template/generators` dir and use `__TOKEN__` placeholders so
 * they never collide with Vue's `{{ }}` interpolation.
 */
class ScaffoldGenerator
{
    private const string CLI_MODULE = 'MageObsidian_ModernFrontendCli';
    private const string TEMPLATE_DIR = 'Template/generators';

    public function __construct(
        private readonly ComponentRegistrarInterface $componentRegistrar,
        private readonly File $fileDriver
    ) {
    }

    /**
     * Render a template, substituting `__TOKEN__` placeholders.
     *
     * @param array<string, string> $replacements Keyed by token name without the
     *                                            surrounding underscores.
     * @throws FileSystemException
     */
    public function render(string $templateName, array $replacements): string
    {
        $contents = $this->fileDriver->fileGetContents($this->templatePath($templateName));
        foreach ($replacements as $token => $value) {
            $contents = str_replace("__{$token}__", $value, $contents);
        }

        return $contents;
    }

    /**
     * Write a file, refusing to overwrite an existing one unless $force.
     *
     * @return bool True if written, false if the file already existed and !$force.
     * @throws FileSystemException
     */
    public function write(string $absolutePath, string $contents, bool $force = false): bool
    {
        if (!$force && $this->fileDriver->isExists($absolutePath)) {
            return false;
        }

        $directory = dirname($absolutePath);
        if (!$this->fileDriver->isDirectory($directory)) {
            $this->fileDriver->createDirectory($directory);
        }

        $this->fileDriver->filePutContents($absolutePath, $contents);

        return true;
    }

    private function templatePath(string $templateName): string
    {
        $base = $this->componentRegistrar->getPath(ComponentRegistrar::MODULE, self::CLI_MODULE);

        return $base . '/' . self::TEMPLATE_DIR . '/' . $templateName;
    }
}
