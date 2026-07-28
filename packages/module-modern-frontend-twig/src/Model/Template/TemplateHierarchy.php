<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use Magento\Framework\Component\ComponentRegistrar;
use Magento\Framework\Component\ComponentRegistrarInterface;
use Magento\Framework\View\Design\Theme\ThemeProviderInterface;
use Magento\Framework\View\Design\ThemeInterface;
use Magento\Framework\View\DesignInterface;
use Magento\Framework\View\FileSystem as ViewFileSystem;
use Twig\Error\LoaderError;

/**
 * Resolves `@parent`: the copy of a template one level up the theme chain from
 * the one that declared it.
 *
 * A theme override cannot simply `{% extends 'Vendor_Module::x.twig' %}` itself
 * — the fallback resolves that name back to the override and Twig recurses. So
 * `@parent` is rewritten while the source is read, into a name that carries the
 * level explicitly. The level is derived from the resolved path, which already
 * identifies the theme (or module) that owns the file, so the rewrite is
 * deterministic and every level of a chain gets its own compiled entry.
 */
class TemplateHierarchy
{
    public const string PARENT = '@parent';

    public const string FROM_PREFIX = '@from:';

    /** Target for a template owned by the most base theme: the module's own copy. */
    public const string MODULE_TARGET = 'module';

    private const string TEMPLATES_DIR = '/templates/';

    /** @var array<string, string>|null Absolute module dir => Vendor_Module. */
    private ?array $modulePaths = null;

    public function __construct(
        private readonly DesignInterface $design,
        private readonly ComponentRegistrarInterface $registrar,
        private readonly ViewFileSystem $viewFileSystem,
        private readonly ThemeProviderInterface $themeProvider
    ) {
    }

    /**
     * @param string $name
     *
     * @return bool
     */
    public function isLevelled(string $name): bool
    {
        return str_starts_with($name, self::FROM_PREFIX);
    }

    /**
     * Replace `@parent` references in a template's source with a levelled name.
     *
     * @param string $code Template source.
     * @param string $path Absolute path the source was read from.
     *
     * @return string
     * @throws LoaderError When `@parent` has nothing above it to point at.
     */
    public function rewrite(string $code, string $path): string
    {
        if (!str_contains($code, self::PARENT)) {
            return $code;
        }

        $canonical = $this->canonicalName($path);
        if ($canonical === null) {
            throw new LoaderError(sprintf(
                '"%s" is used in "%s", which is not a template of a module or theme.',
                self::PARENT,
                $path
            ));
        }

        $target = $this->targetAbove($path);
        if ($target === null) {
            throw new LoaderError(sprintf(
                '"%s" is used in "%s", a module template — there is no copy above it. '
                . 'Only a theme override can extend what it overrides.',
                self::PARENT,
                $path
            ));
        }

        $levelled = self::FROM_PREFIX . $target . ':' . $canonical;

        return (string)preg_replace(
            '/([\'"])' . preg_quote(self::PARENT, '/') . '\1/',
            '$1' . $levelled . '$1',
            $code
        );
    }

    /**
     * The template a levelled name points at, without its level.
     *
     * @param string $name
     *
     * @return string
     */
    public function templateOf(string $name): string
    {
        return $this->split($name)[1] ?? $name;
    }

    /**
     * Resolve `@from:<target>:<Vendor_Module::path>` to an absolute file path.
     *
     * @param string $name
     *
     * @return string|null
     */
    public function resolveLevelled(string $name): ?string
    {
        $parts = $this->split($name);
        if ($parts === null) {
            return null;
        }

        [$target, $template] = $parts;

        if ($target === self::MODULE_TARGET) {
            return $this->moduleTemplatePath($template);
        }

        $theme = $this->themeProvider->getThemeByFullPath($target);
        if (!$theme instanceof ThemeInterface) {
            return null;
        }

        $file = $this->viewFileSystem->getTemplateFileName($template, ['themeModel' => $theme]);

        return $file && is_file($file) ? $file : null;
    }

    /**
     * Split a levelled name into its target and its template. The template
     * carries its own `::`, so the split is on the first separator after the
     * prefix, never the last.
     *
     * @param string $name
     *
     * @return array{0: string, 1: string}|null
     */
    private function split(string $name): ?array
    {
        if (!$this->isLevelled($name)) {
            return null;
        }

        $rest = substr($name, strlen(self::FROM_PREFIX));
        $separator = strpos($rest, ':');

        return $separator === false
            ? null
            : [substr($rest, 0, $separator), substr($rest, $separator + 1)];
    }

    /**
     * Full path of the theme one level above the owner of `$path`, or
     * {@see self::MODULE_TARGET} when the owner is the most base theme.
     *
     * @param string $path
     *
     * @return string|null Null when the owner is a module.
     */
    private function targetAbove(string $path): ?string
    {
        $owner = $this->ownerTheme($path);
        if ($owner === null) {
            return null;
        }

        $parent = $owner->getParentTheme();

        return $parent instanceof ThemeInterface ? (string)$parent->getFullPath() : self::MODULE_TARGET;
    }

    /**
     * @param string $path
     *
     * @return ThemeInterface|null
     */
    private function ownerTheme(string $path): ?ThemeInterface
    {
        $theme = $this->design->getDesignTheme();
        foreach ($theme->getInheritedThemes() as $candidate) {
            $directory = $this->registrar->getPath(ComponentRegistrar::THEME, (string)$candidate->getFullPath());
            if ($directory && str_starts_with($path, rtrim($directory, '/') . '/')) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Rebuild the `Vendor_Module::path.twig` name a file is reachable by, from
     * its location: themes lay templates out as `<theme>/Vendor_Module/templates/…`
     * and modules as `<module>/view/<area>/templates/…`.
     *
     * @param string $path
     *
     * @return string|null
     */
    private function canonicalName(string $path): ?string
    {
        $owner = $this->ownerTheme($path);
        if ($owner !== null) {
            $directory = (string)$this->registrar->getPath(
                ComponentRegistrar::THEME,
                (string)$owner->getFullPath()
            );
            $relative = ltrim(substr($path, strlen(rtrim($directory, '/'))), '/');
            $separator = strpos($relative, self::TEMPLATES_DIR);

            return $separator === false
                ? null
                : substr($relative, 0, $separator) . '::' . substr($relative, $separator + strlen(self::TEMPLATES_DIR));
        }

        foreach ($this->modulePaths() as $directory => $module) {
            if (!str_starts_with($path, $directory . '/')) {
                continue;
            }
            $separator = strpos($path, self::TEMPLATES_DIR, strlen($directory));

            return $separator === false
                ? null
                : $module . '::' . substr($path, $separator + strlen(self::TEMPLATES_DIR));
        }

        return null;
    }

    /**
     * @param string $template `Vendor_Module::path.twig`
     *
     * @return string|null
     */
    private function moduleTemplatePath(string $template): ?string
    {
        [$module, $file] = array_pad(explode('::', $template, 2), 2, null);
        if ($file === null) {
            return null;
        }

        $directory = $this->registrar->getPath(ComponentRegistrar::MODULE, $module);
        if (!$directory) {
            return null;
        }

        $path = rtrim($directory, '/') . '/view/' . $this->design->getArea() . self::TEMPLATES_DIR . $file;

        return is_file($path) ? $path : null;
    }

    /**
     * @return array<string, string>
     */
    private function modulePaths(): array
    {
        if ($this->modulePaths !== null) {
            return $this->modulePaths;
        }

        $paths = [];
        foreach ($this->registrar->getPaths(ComponentRegistrar::MODULE) as $module => $directory) {
            $paths[rtrim($directory, '/')] = $module;
        }

        return $this->modulePaths = $paths;
    }
}
