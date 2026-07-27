<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Plugin\App\Cache;

use Magento\Framework\App\Cache\Manager;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;

/**
 * Makes `bin/magento cache:flush` reach the compiled Twig templates.
 *
 * Manager::flush() cleans cache backends through the frontend pool instead of
 * calling the cache type instances, so the type's own clean() never runs. A
 * module cannot register a dedicated frontend in that pool (it comes from
 * env.php), which leaves this plugin as the way in.
 */
class FlushCompiledTemplates
{
    /**
     * @param CompiledTemplateCache $compiledTemplateCache
     */
    public function __construct(
        private readonly CompiledTemplateCache $compiledTemplateCache
    ) {
    }

    /**
     * @param Manager $subject
     * @param mixed $result
     * @param string[] $types Empty when every type is flushed.
     *
     * @return mixed
     */
    public function afterFlush(Manager $subject, mixed $result, array $types = []): mixed
    {
        if ($types === [] || in_array(CompiledTemplates::TYPE_IDENTIFIER, $types, true)) {
            $this->compiledTemplateCache->clear();
        }

        return $result;
    }
}
