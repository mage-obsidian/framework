<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\TemplateEngine;

use Magento\Framework\View\Element\BlockInterface;
use Magento\Framework\View\TemplateEngineInterface;
use MageObsidian\ModernFrontendTwig\Model\Template\EnvironmentFactory;

/**
 * Renders `.twig` templates within the context of a Magento block.
 *
 * Registered for the "twig" engine name (= file extension) in di.xml, so it is
 * dispatched by Magento\Framework\View\Element\Template::fetchView for any
 * template ending in `.twig`, while `.phtml` keeps using the native PHP engine.
 *
 * Unlike the native engine — which `include`s the template with `$this` bound
 * to the block — Twig has no implicit `$this`. The block is exposed as the
 * `block` variable; its data is reachable via `{{ block.getX() }}` /
 * `{{ block.getData('x') }}`, and the MageObsidian helpers (render_vue,
 * child_html, hero_icon, …) are provided by the Twig extension.
 */
class Twig implements TemplateEngineInterface
{
    /**
     * @param EnvironmentFactory $environmentFactory
     */
    public function __construct(
        private readonly EnvironmentFactory $environmentFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function render(BlockInterface $block, $templateFile, array $dictionary = [])
    {
        $context = $dictionary;
        $context['block'] = $block;

        return $this->environmentFactory->create()->render($templateFile, $context);
    }
}
