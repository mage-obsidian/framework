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
use Magento\Framework\Module\ModuleListInterface;

/**
 * Twig namespace table: `@alias/path.twig` resolves to `Vendor_Module::path.twig`.
 *
 * Every enabled module gets a vendor-qualified alias, which cannot collide and
 * does not change when another module is enabled — that is the form a template
 * can rely on. The bare module name is registered on top of it, and when more
 * than one vendor ships the same module name the tie is broken by which of them
 * actually contains templates: `MageObsidian_Catalog` extends `Magento_Catalog`
 * with code and JS but ships no `view/*&#47;templates`, so `@catalog` is the core
 * module's without ambiguity. A tie neither or both sides can win is left
 * unregistered rather than decided silently, and di.xml settles it permanently.
 */
class TemplateNamespaces
{
    public const string PREFIX = '@';

    private const array TEMPLATE_DIRS = ['/view/frontend/templates', '/view/adminhtml/templates', '/view/base/templates'];

    /** @var array<string, string>|null alias => Vendor_Module */
    private ?array $table = null;

    /** @var array<string, list<string>>|null short alias => modules that claimed it */
    private ?array $ambiguous = null;

    /**
     * @param ModuleListInterface $moduleList
     * @param ComponentRegistrarInterface $registrar
     * @param array<string, string> $namespaces Explicit alias => Vendor_Module, injected via di.xml.
     */
    public function __construct(
        private readonly ModuleListInterface $moduleList,
        private readonly ComponentRegistrarInterface $registrar,
        private readonly array $namespaces = []
    ) {
    }

    /**
     * The resolved table, explicit entries last so they win.
     *
     * @return array<string, string>
     */
    public function getAll(): array
    {
        if ($this->table !== null) {
            return $this->table;
        }

        $qualified = [];
        $claims = [];

        foreach ($this->moduleList->getNames() as $module) {
            $parts = explode('_', $module, 2);
            if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
                continue;
            }
            [$vendor, $name] = $parts;
            $bare = self::kebab($name);
            $qualified[self::kebab($vendor) . '-' . $bare] = $module;
            $claims[$bare][] = $module;
        }

        $unique = [];
        $ambiguous = [];
        foreach ($claims as $alias => $modules) {
            // Only a contested alias pays for the filesystem check, so the common
            // case never stats anything.
            $contenders = count($modules) === 1 ? $modules : array_values(array_filter($modules, $this->shipsTemplates(...)));
            if (count($contenders) === 1) {
                $unique[$alias] = $contenders[0];
                continue;
            }
            sort($modules);
            $ambiguous[$alias] = $modules;
        }

        $this->ambiguous = $ambiguous;
        $table = array_merge($qualified, $unique, $this->namespaces);
        ksort($table);

        return $this->table = $table;
    }

    /**
     * Short aliases no module owns because more than one claims them.
     *
     * @return array<string, list<string>>
     */
    public function getAmbiguous(): array
    {
        $this->getAll();

        return array_diff_key($this->ambiguous ?? [], $this->namespaces);
    }

    /**
     * Expand `@alias/path.twig` into `Vendor_Module::path.twig`.
     *
     * @param string $name
     *
     * @return string|null Null when the name is not an alias reference at all;
     *                     the caller distinguishes that from an unknown alias.
     */
    public function expand(string $name): ?string
    {
        if (!str_starts_with($name, self::PREFIX)) {
            return null;
        }

        $separator = strpos($name, '/');
        if ($separator === false) {
            return null;
        }

        $alias = substr($name, 1, $separator - 1);
        $module = $this->getAll()[$alias] ?? null;

        return $module === null ? null : $module . '::' . substr($name, $separator + 1);
    }

    /**
     * Aliases close enough to a failed one to be worth suggesting.
     *
     * @param string $alias
     *
     * @return list<string>
     */
    public function suggest(string $alias): array
    {
        $matches = [];
        foreach (array_keys($this->getAll()) as $candidate) {
            if (levenshtein($alias, $candidate) <= 3 || str_contains($candidate, $alias)) {
                $matches[] = self::PREFIX . $candidate;
            }
        }

        return array_slice($matches, 0, 5);
    }

    /**
     * Identity of the table, so compiled templates are dropped when it changes.
     *
     * @return string
     */
    public function getSignature(): string
    {
        return hash('xxh128', (string)json_encode($this->getAll()));
    }

    /**
     * @param string $module
     *
     * @return bool
     */
    private function shipsTemplates(string $module): bool
    {
        $directory = $this->registrar->getPath(ComponentRegistrar::MODULE, $module);
        if (!$directory) {
            return false;
        }

        foreach (self::TEMPLATE_DIRS as $candidate) {
            if (is_dir($directory . $candidate)) {
                return true;
            }
        }

        return false;
    }

    /**
     * `InventoryStockVisualizer` => `inventory-stock-visualizer`, and acronyms
     * stay whole: `CatalogUrlRewrite` and `CatalogURLRewrite` both collapse to
     * `catalog-url-rewrite`.
     *
     * @param string $name
     *
     * @return string
     */
    private static function kebab(string $name): string
    {
        return strtolower((string)preg_replace(
            ['/([a-z\d])([A-Z])/', '/([A-Z]+)([A-Z][a-z])/'],
            '$1-$2',
            $name
        ));
    }
}
