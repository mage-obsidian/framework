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
use MageObsidian\ModernFrontend\ViewModel\ViteResolver;

/**
 * Emits the <script type="module"> tag that loads a Vite-built enhancer.
 *
 * Reads the ViteResolver directly instead of going through the rendering block,
 * so an enhancer can be pulled in from a template rendered by a core block —
 * `vite_url` cannot, and that is exactly where page furniture like the toolbar
 * and the pager live. The nonce comes from SecureHtmlRenderer, which an inline
 * <script> written by hand does not get.
 */
class ScriptTag
{
    /**
     * @param ViteResolver $viteResolver
     * @param SecureHtmlRenderer $secureRenderer
     */
    public function __construct(
        private readonly ViteResolver $viteResolver,
        private readonly SecureHtmlRenderer $secureRenderer
    ) {
    }

    /**
     * Render the module script tag for a Vite-built asset.
     *
     * @param string $path A module web asset, e.g. "Vendor_Module::js/thing".
     *
     * @return string
     */
    public function module(string $path): string
    {
        return $this->secureRenderer->renderTag(
            'script',
            ['type' => 'module', 'src' => $this->viteResolver->getViteFileUrl($path)],
            '',
            false
        );
    }
}
