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

/**
 * Delegations from Twig helper functions to the block currently rendering the
 * template. Kept free of Magento and Twig dependencies so the delegation and
 * the "unsupported block" guard are unit-testable in isolation; the Twig
 * extension only wires these into TwigFunctions.
 *
 * `getChildHtml` exists on every Magento block, but the MageObsidian bridge
 * methods (renderVueComponent, getHeroIcon, …) only exist on the MageObsidian
 * ModernFrontend Template block. A `.twig` rendered by an unrelated block would
 * otherwise hit Magento's magic `__call` and fail with an opaque error, so we
 * check for a real method first and raise an actionable one instead.
 */
class BridgeFunctions
{
    /**
     * Mount a Vue island. Returns markup, so the Twig function is marked safe.
     *
     * @param object $block
     * @param string $componentName
     * @param array $props
     * @param bool $eager Mount immediately instead of on viewport entry (above-the-fold).
     *
     * @return string
     */
    public function renderVue(object $block, string $componentName, array $props = [], bool $eager = false): string
    {
        $this->assertSupports($block, 'renderVueComponent', 'render_vue');
        return $block->renderVueComponent($componentName, $props, $eager);
    }

    /**
     * Emit a schema.org JSON-LD `<script>` for a custom type. Returns markup, so
     * the Twig function is marked safe.
     *
     * @param object $block
     * @param string $type
     * @param array $data
     *
     * @return string
     */
    public function jsonLd(object $block, string $type, array $data = []): string
    {
        $this->assertSupports($block, 'renderJsonLd', 'json_ld');
        return $block->renderJsonLd($type, $data);
    }

    /**
     * Render a Core-Web-Vitals-friendly image. Returns markup, so the Twig
     * function is marked safe.
     *
     * @param object $block
     * @param string $src
     * @param array $options
     *
     * @return string
     */
    public function image(object $block, string $src, array $options = []): string
    {
        $this->assertSupports($block, 'renderImage', 'image');
        return $block->renderImage($src, $options);
    }

    /**
     * Render a child block declared in layout (available on every Magento block).
     *
     * @param object $block
     * @param string $alias
     * @param bool $useCache
     *
     * @return string
     */
    public function childHtml(object $block, string $alias = '', bool $useCache = true): string
    {
        $this->assertSupports($block, 'getChildHtml', 'child_html');
        return $block->getChildHtml($alias, $useCache);
    }

    /**
     * Inline a Heroicons SVG.
     *
     * @param object $block
     * @param string $iconName
     * @param string $iconSet
     * @param string $size
     *
     * @return string
     */
    public function heroIcon(
        object $block,
        string $iconName,
        string $iconSet = 'solid',
        string $size = '24'
    ): string {
        $this->assertSupports($block, 'getHeroIcon', 'hero_icon');
        return $block->getHeroIcon($iconName, $iconSet, $size);
    }

    /**
     * URL of a Vite-generated file.
     *
     * @param object $block
     * @param string $path
     *
     * @return string
     */
    public function viteUrl(object $block, string $path): string
    {
        $this->assertSupports($block, 'getViteFileUrl', 'vite_url');
        return $block->getViteFileUrl($path);
    }

    /**
     * Resolve a component path by its "Vendor::Component" name.
     *
     * @param object $block
     * @param string $name
     *
     * @return string
     */
    public function componentPath(object $block, string $name): string
    {
        $this->assertSupports($block, 'resolveComponentPath', 'component_path');
        return $block->resolveComponentPath($name);
    }

    /**
     * URL of a view file (available on every Magento block).
     *
     * @param object $block
     * @param string $fileId
     * @param array $params
     *
     * @return string
     */
    public function viewFileUrl(object $block, string $fileId, array $params = []): string
    {
        $this->assertSupports($block, 'getViewFileUrl', 'view_file_url');
        return $block->getViewFileUrl($fileId, $params);
    }

    /**
     * @param object $block
     * @param string $method
     * @param string $helper Twig function name, for the error message.
     *
     * @throws LogicException When the rendering block does not expose $method.
     */
    private function assertSupports(object $block, string $method, string $helper): void
    {
        if (!method_exists($block, $method)) {
            throw new LogicException(sprintf(
                'The "%s" Twig helper requires the rendering block to expose %s(); %s does not. '
                . 'Use a block extending MageObsidian\\ModernFrontend\\Block\\Template.',
                $helper,
                $method,
                $block::class
            ));
        }
    }
}
