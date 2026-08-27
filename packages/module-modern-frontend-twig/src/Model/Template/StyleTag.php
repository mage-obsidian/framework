<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use Magento\Framework\View\Helper\SecureHtmlRenderer;

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
    /**
     * @param SecureHtmlRenderer $secureRenderer
     */
    public function __construct(private readonly SecureHtmlRenderer $secureRenderer)
    {
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

        return $this->secureRenderer->renderTag('style', $attributes, $css, false);
    }
}
