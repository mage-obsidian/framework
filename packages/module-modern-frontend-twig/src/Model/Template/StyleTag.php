<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use Magento\Framework\View\Helper\SecureHtmlRenderer;
use MageObsidian\ModernFrontend\Service\Csp\InlineStylePolicy;

/**
 * Emits an inline <style> through SecureHtmlRenderer.
 *
 * A hand-written <style> is invisible to the platform, so nothing whitelists it
 * and an enforcing policy drops the rules on the floor. Going through the
 * renderer registers the fragment's hash in the response's own policy, which is
 * how Magento admits a stylesheet it cannot move to a file — generated container
 * queries, per-page critical CSS, the cloak rule that has to apply before any
 * sheet arrives.
 */
class StyleTag
{
    private const string ADOPT = '(function(d,c,a){var S=window.CSSStyleSheet;try{if(typeof S==="function"&&"adoptedStyleSheets" in d){var s=new S();s.replaceSync(c);d.adoptedStyleSheets=Array.prototype.slice.call(d.adoptedStyleSheets).concat([s]);return;}}catch(e){}var t=d.createElement("style");for(var k in a){t.setAttribute(k,a[k]);}t.appendChild(d.createTextNode(c));(d.head||d.documentElement).appendChild(t);})(document,%s,%s);';

    /**
     * @param SecureHtmlRenderer $secureRenderer
     */
    public function __construct(
        private readonly SecureHtmlRenderer $secureRenderer,
        private readonly InlineStylePolicy $inlineStylePolicy
    ) {
    }

    /**
     * Render a whitelisted stylesheet built from selector => declarations.
     *
     * Per-element values — a swatch's own colour, a transition name per card, a
     * bar's computed width — cannot live in a style attribute under an enforcing
     * policy: a nonce does not apply to one and a hash would need one entry per
     * distinct value. Collected into a single element they are hashed like any
     * other stylesheet.
     *
     * @param array<string, string> $rules
     * @param array<string, string> $attributes
     *
     * @return string
     */
    public function rules(array $rules, array $attributes = []): string
    {
        $css = '';
        foreach ($rules as $selector => $declarations) {
            $declarations = trim((string)$declarations, " \t\n;");
            if (trim((string)$selector) === '' || $declarations === '') {
                continue;
            }
            $css .= sprintf('%s{%s}', $selector, $declarations);
        }

        return $this->inline($css, $attributes);
    }

    /**
     * Render a whitelisted inline stylesheet.
     *
     * @param string $css
     * @param array<string, string> $attributes
     *
     * @return string
     */
    public function inline(string $css, array $attributes = []): string
    {
        if (trim($css) === '') {
            return '';
        }

        if ($this->inlineStylePolicy->allowsInlineStyles()) {
            return $this->secureRenderer->renderTag('script', [], $this->adoption($css, $attributes), false);
        }

        return $this->secureRenderer->renderTag('style', $attributes, $css, false);
    }

    private function adoption(string $css, array $attributes): string
    {
        $flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;

        return sprintf(self::ADOPT, json_encode($css, $flags), json_encode((object)$attributes, $flags));
    }
}
