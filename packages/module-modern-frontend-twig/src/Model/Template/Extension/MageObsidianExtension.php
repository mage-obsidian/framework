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
use Magento\Framework\Phrase;
use MageObsidian\ModernFrontend\Service\Vue\IslandMarkup;
use MageObsidian\ModernFrontendTwig\Model\Template\BridgeFunctions;
use MageObsidian\ModernFrontendTwig\Model\Template\ScriptTag;
use MageObsidian\ModernFrontendTwig\Model\Template\ViewFileInliner;
use Twig\Extension\AbstractExtension;
use Twig\Error\RuntimeError;
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
     * @param IslandMarkup $islandMarkup
     * @param ViewFileInliner $viewFileInliner
     * @param ScriptTag $scriptTag
     */
    public function __construct(
        private readonly BridgeFunctions $bridge,
        private readonly Escaper $escaper,
        private readonly IslandMarkup $islandMarkup,
        private readonly ViewFileInliner $viewFileInliner,
        private readonly ScriptTag $scriptTag
    ) {
    }

    /**
     * The rendering block, which every markup helper needs.
     *
     * `{% include … only %}` drops it along with the rest of the context, so the
     * failure is common enough to deserve its own message instead of a PHP
     * warning about a missing array key.
     *
     * @param array<string, mixed> $context
     *
     * @return object
     * @throws RuntimeError
     */
    private function blockOf(array $context): object
    {
        $block = $context['block'] ?? null;
        if (!is_object($block)) {
            throw new RuntimeError(
                'No rendering block in the Twig context. A template included with `only` does not '
                . 'inherit it — pass it through: {% include "…" with { block: block, … } only %}.'
            );
        }

        return $block;
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
                fn(
                    array $context,
                    string $name,
                    array $props = [],
                    bool $eager = false,
                    string $serverHtml = '',
                    bool $hydrate = false
                ): string => $this->bridge->renderVue($this->blockOf($context), $name, $props, $eager, $serverHtml, $hydrate),
                $safeHtml
            ),
            new TwigFunction(
                'child_html',
                fn(array $context, string $alias = '', bool $useCache = true): string
                    => $this->bridge->childHtml($this->blockOf($context), $alias, $useCache),
                $safeHtml
            ),
            new TwigFunction(
                'hero_icon',
                fn(
                    array $context,
                    string $name,
                    string $set = 'solid',
                    string $size = '24',
                    string $class = ''
                ): string => $this->bridge->heroIcon($this->blockOf($context), $name, $set, $size, $class),
                $safeHtml
            ),
            new TwigFunction(
                'json_ld',
                fn(array $context, string $type, array $data = []): string
                    => $this->bridge->jsonLd($this->blockOf($context), $type, $data),
                $safeHtml
            ),
            new TwigFunction(
                'image',
                fn(array $context, string $src, array $options = []): string
                    => $this->bridge->image($this->blockOf($context), $src, $options),
                $safeHtml
            ),
            new TwigFunction(
                'vite_url',
                fn(array $context, string $path): string
                    => $this->bridge->viteUrl($this->blockOf($context), $path),
                $url
            ),
            new TwigFunction(
                'component_path',
                fn(array $context, string $name): string
                    => $this->bridge->componentPath($this->blockOf($context), $name),
                $url
            ),
            new TwigFunction(
                'script',
                fn(string $path): string => $this->scriptTag->module($path),
                ['is_safe' => ['html']]
            ),
            new TwigFunction(
                'inline_view_file',
                fn(string $fileId): string => $this->viewFileInliner->inline($fileId),
                ['is_safe' => ['html']]
            ),
            new TwigFunction(
                'view_file_url',
                fn(array $context, string $fileId, array $params = []): string
                    => $this->bridge->viewFileUrl($this->blockOf($context), $fileId, $params),
                $url
            ),
            // i18n. Mirrors phtml's __(): a Phrase translated by Magento's
            // process-wide renderer, with %1/%2 numbered argument substitution.
            // Left un-flagged so Twig HTML-escapes the translated text by default.
            new TwigFunction(
                '__',
                static fn(string $text, mixed ...$arguments): string
                    => (string)new Phrase($text, $arguments)
            ),
        ];
    }

    /**
     * @inheritDoc
     */
    public function getFilters(): array
    {
        // These delegate to Magento's Escaper, which already returns markup-safe
        // output. Flag them is_safe('html') so the html autoescaper does not escape
        // a second time (which would turn `&` into `&amp;amp;` and break URLs).
        $safe = ['is_safe' => ['html']];

        // preserves_safety stops Twig re-escaping the block the filter captured.
        $markup = ['is_safe' => ['html'], 'preserves_safety' => ['html']];

        return [
            new TwigFilter('escape_url', fn($value): string => $this->escaper->escapeUrl((string)$value), $safe),
            new TwigFilter('escape_html_attr', fn($value): string => $this->escaper->escapeHtmlAttr((string)$value), $safe),
            new TwigFilter('escape_js', fn($value): string => $this->escaper->escapeJs((string)$value), $safe),
            new TwigFilter('escape_css', fn($value): string => $this->escaper->escapeCss((string)$value), $safe),
            new TwigFilter('island_list', fn($value): string => $this->islandMarkup->list((string)$value), $markup),
            new TwigFilter(
                'island_if',
                fn($value, mixed $condition): string => $this->islandMarkup->if((bool)$condition, (string)$value),
                $markup
            ),
        ];
    }
}
