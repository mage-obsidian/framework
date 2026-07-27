<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Cache\Type;

use Magento\Framework\App\Cache\Type\FrontendPool;
use Magento\Framework\Cache\Frontend\Decorator\TagScope;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use Zend_Cache;

/**
 * The "Twig Templates" cache type.
 *
 * Declared in cache.xml, which requires a FrontendInterface instance, so it
 * decorates the default frontend the same way Magento's own types do. The
 * compiled templates themselves live on disk rather than in that frontend —
 * they are PHP files Twig has to `include` for opcache to keep them — so
 * cleaning the type also wipes them.
 *
 * Magento\Framework\App\Cache\TypeList::cleanType() routes `cache:clean` and the
 * admin grid here. `cache:flush` bypasses type instances entirely, hence the
 * plugin on Magento\Framework\App\Cache\Manager.
 */
class CompiledTemplates extends TagScope
{
    public const string TYPE_IDENTIFIER = 'twig_templates';
    public const string CACHE_TAG = 'TWIG_TEMPLATES';

    /**
     * @param FrontendPool $cacheFrontendPool
     * @param CompiledTemplateCache $compiledTemplateCache
     */
    public function __construct(
        FrontendPool $cacheFrontendPool,
        private readonly CompiledTemplateCache $compiledTemplateCache
    ) {
        parent::__construct($cacheFrontendPool->get(self::TYPE_IDENTIFIER), self::CACHE_TAG);
    }

    /**
     * @inheritDoc
     */
    public function clean($mode = Zend_Cache::CLEANING_MODE_ALL, array $tags = [])
    {
        // A tag-scoped clean targets entries unrelated to compilation; only a
        // clean of the whole type means "rebuild the templates".
        if ($mode === Zend_Cache::CLEANING_MODE_ALL) {
            $this->compiledTemplateCache->clear();
        }

        return parent::clean($mode, $tags);
    }
}
