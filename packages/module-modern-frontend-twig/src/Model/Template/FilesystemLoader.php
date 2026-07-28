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
 *
 * Two namespaced forms sit on top of that: `@alias/path.twig` shortens the
 * module reference ({@see TemplateNamespaces}), and `@parent` reaches the copy
 * one level up the theme chain ({@see TemplateHierarchy}).
 */
class FilesystemLoader implements LoaderInterface
{
    /**
     * @param ViewFileSystem $viewFileSystem
     * @param TemplateNamespaces $namespaces
     * @param TemplateHierarchy $hierarchy
     */
    public function __construct(
        private readonly ViewFileSystem $viewFileSystem,
        private readonly TemplateNamespaces $namespaces,
        private readonly TemplateHierarchy $hierarchy
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

        return new Source($this->hierarchy->rewrite($code, $path), $name, $path);
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

        if ($this->hierarchy->isLevelled($name)) {
            $path = $this->hierarchy->resolveLevelled($name);
            if ($path !== null) {
                return $path;
            }

            throw new LoaderError(sprintf(
                'No copy of "%s" exists above the theme that referenced it with "%s".',
                $this->hierarchy->templateOf($name),
                TemplateHierarchy::PARENT
            ));
        }

        $name = $this->expandAlias($name);

        if (str_contains($name, '::')) {
            $file = $this->viewFileSystem->getTemplateFileName($name);
            if ($file && is_file($file)) {
                return $file;
            }
        }

        throw new LoaderError(sprintf('Twig template "%s" could not be resolved through the theme fallback.', $name));
    }

    /**
     * @param string $name
     *
     * @return string
     * @throws LoaderError When the name uses an alias no module owns.
     */
    private function expandAlias(string $name): string
    {
        if (!str_starts_with($name, TemplateNamespaces::PREFIX)) {
            return $name;
        }

        $expanded = $this->namespaces->expand($name);
        if ($expanded !== null) {
            return $expanded;
        }

        $alias = strstr(substr($name, 1), '/', true) ?: substr($name, 1);
        $suggestions = $this->namespaces->suggest($alias);

        throw new LoaderError(sprintf(
            'Twig namespace "%s%s" is not registered.%s',
            TemplateNamespaces::PREFIX,
            $alias,
            $suggestions === [] ? '' : ' Did you mean ' . implode(', ', $suggestions) . '?'
        ));
    }
}
