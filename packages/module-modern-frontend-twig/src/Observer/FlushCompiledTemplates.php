<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Observer;

use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;

/**
 * Makes the admin's "Flush Magento Cache" and "Flush Cache Storage" buttons
 * reach the compiled Twig templates.
 *
 * Both controllers iterate the frontend pool directly rather than going through
 * Cache\Manager, so the plugin on flush() does not cover them; the events they
 * dispatch do.
 */
class FlushCompiledTemplates implements ObserverInterface
{
    /**
     * @param CompiledTemplateCache $compiledTemplateCache
     */
    public function __construct(
        private readonly CompiledTemplateCache $compiledTemplateCache
    ) {
    }

    /**
     * @inheritDoc
     */
    public function execute(Observer $observer): void
    {
        $this->compiledTemplateCache->clear();
    }
}
