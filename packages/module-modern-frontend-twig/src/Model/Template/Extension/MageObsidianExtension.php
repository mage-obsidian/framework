<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template\Extension;

use Magento\Framework\Escaper;
use MageObsidian\ModernFrontendTwig\Model\Template\BridgeFunctions;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;

/**
 * Exposes the MageObsidian phtml bridge to Twig templates.
 *
 * Markup-emitting helpers (render_vue, child_html, hero_icon) are flagged
 * `is_safe => html` so Twig's HTML auto-escaping leaves their output intact;
 * URL helpers are left escaped by default. All read the rendering block from
 * the Twig context (`needs_context`), so nested/recursive renders each address
 * their own block instead of a shared "current block".
 *
 * The remaining Magento context-aware escapers (URL, attribute, JS, CSS) are
 * surfaced as filters mirroring `$escaper->escape*` in phtml; HTML escaping is
 * already the Twig default and needs no filter.
 */
class MageObsidianExtension extends AbstractExtension
{
    /**
     * @param BridgeFunctions $bridge
     * @param Escaper $escaper
     */
    public function __construct(
        private readonly BridgeFunctions $bridge,
        private readonly Escaper $escaper
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getFunctions(): array
    {
        $safeHtml = ['needs_context' => true, 'is_safe' => ['html']];
        $url = ['needs_context' => true];

        return [
            new TwigFunction(
                'render_vue',
                fn(array $context, string $name, array $props = []): string
                    => $this->bridge->renderVue($context['block'], $name, $props),
                $safeHtml
            ),
            new TwigFunction(
                'child_html',
                fn(array $context, string $alias = '', bool $useCache = true): string
                    => $this->bridge->childHtml($context['block'], $alias, $useCache),
                $safeHtml
            ),
            new TwigFunction(
                'hero_icon',
                fn(array $context, string $name, string $set = 'solid', string $size = '24'): string
                    => $this->bridge->heroIcon($context['block'], $name, $set, $size),
                $safeHtml
            ),
            new TwigFunction(
                'json_ld',
                fn(array $context, string $type, array $data = []): string
                    => $this->bridge->jsonLd($context['block'], $type, $data),
                $safeHtml
            ),
            new TwigFunction(
                'image',
                fn(array $context, string $src, array $options = []): string
                    => $this->bridge->image($context['block'], $src, $options),
                $safeHtml
            ),
            new TwigFunction(
                'vite_url',
                fn(array $context, string $path): string
                    => $this->bridge->viteUrl($context['block'], $path),
                $url
            ),
            new TwigFunction(
                'component_path',
                fn(array $context, string $name): string
                    => $this->bridge->componentPath($context['block'], $name),
                $url
            ),
            new TwigFunction(
                'view_file_url',
                fn(array $context, string $fileId, array $params = []): string
                    => $this->bridge->viewFileUrl($context['block'], $fileId, $params),
                $url
            ),
        ];
    }

    /**
     * @inheritDoc
     */
    public function getFilters(): array
    {
        return [
            new TwigFilter('escape_url', fn($value): string => $this->escaper->escapeUrl((string)$value)),
            new TwigFilter('escape_html_attr', fn($value): string => $this->escaper->escapeHtmlAttr((string)$value)),
            new TwigFilter('escape_js', fn($value): string => $this->escaper->escapeJs((string)$value)),
            new TwigFilter('escape_css', fn($value): string => $this->escaper->escapeCss((string)$value)),
        ];
    }
}
