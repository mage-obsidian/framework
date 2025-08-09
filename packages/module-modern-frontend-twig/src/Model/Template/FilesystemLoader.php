<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use Magento\Framework\View\FileSystem as ViewFileSystem;
use Twig\Error\LoaderError;
use Twig\Loader\LoaderInterface;
use Twig\Source;

/**
 * Twig loader that resolves template names through Magento's view fallback.
 *
 * The entry template Magento passes to the engine is already an absolute path,
 * so it is read directly. References inside templates (`{% extends %}`,
 * `{% include %}`) written as `Vendor_Module::path.twig` are resolved with the
 * same theme fallback the native phtml engine uses, so a child theme can
 * override a parent's `.twig` exactly like a `.phtml`.
 */
class FilesystemLoader implements LoaderInterface
{
    /**
     * @param ViewFileSystem $viewFileSystem
     */
    public function __construct(
        private readonly ViewFileSystem $viewFileSystem
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getSourceContext(string $name): Source
    {
        $path = $this->resolve($name);
        $code = @file_get_contents($path);
        if ($code === false) {
            throw new LoaderError(sprintf('Unable to read Twig template "%s" (%s).', $name, $path));
        }
        return new Source($code, $name, $path);
    }

    /**
     * @inheritDoc
     */
    public function getCacheKey(string $name): string
    {
        return $this->resolve($name);
    }

    /**
     * @inheritDoc
     */
    public function isFresh(string $name, int $time): bool
    {
        $mtime = @filemtime($this->resolve($name));
        return $mtime !== false && $mtime <= $time;
    }

    /**
     * @inheritDoc
     */
    public function exists(string $name): bool
    {
        try {
            return $this->resolve($name) !== '';
        } catch (LoaderError) {
            return false;
        }
    }

    /**
     * Resolve a template name to an absolute, existing file path.
     *
     * @param string $name
     *
     * @return string
     * @throws LoaderError When the template cannot be located.
     */
    private function resolve(string $name): string
    {
        if (is_file($name)) {
            return $name;
        }

        if (str_contains($name, '::')) {
            $file = $this->viewFileSystem->getTemplateFileName($name);
            if ($file && is_file($file)) {
                return $file;
            }
        }

        throw new LoaderError(sprintf('Twig template "%s" could not be resolved through the theme fallback.', $name));
    }
}
