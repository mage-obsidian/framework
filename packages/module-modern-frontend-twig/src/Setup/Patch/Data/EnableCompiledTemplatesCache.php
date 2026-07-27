<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Setup\Patch\Data;

use Magento\Framework\App\Cache\Manager;
use Magento\Framework\App\Cache\State;
use Magento\Framework\App\DeploymentConfig;
use Magento\Framework\Setup\Patch\DataPatchInterface;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Records the `twig_templates` type as enabled on installs that predate it.
 *
 * Magento seeds cache type states only at `setup:install`, so on an upgrade the
 * new type would keep showing as disabled in `cache:status` and the admin grid
 * while it is in fact caching (see {@see CacheTypeState}). This aligns what the
 * operator is shown with what happens.
 */
class EnableCompiledTemplatesCache implements DataPatchInterface
{
    /**
     * @param Manager $cacheManager
     * @param DeploymentConfig $deploymentConfig
     * @param LoggerInterface $logger
     */
    public function __construct(
        private readonly Manager $cacheManager,
        private readonly DeploymentConfig $deploymentConfig,
        private readonly LoggerInterface $logger
    ) {
    }

    /**
     * @return $this
     */
    public function apply(): self
    {
        $key = State::CACHE_KEY . '/' . CompiledTemplates::TYPE_IDENTIFIER;
        if ($this->deploymentConfig->get($key) !== null) {
            return $this;
        }

        try {
            $this->cacheManager->setEnabled([CompiledTemplates::TYPE_IDENTIFIER], true);
        } catch (Throwable $exception) {
            // Pipelines that ship a read-only env.php cannot record this, and
            // failing the upgrade over a status line would be worse: caching
            // works either way.
            $this->logger->warning(
                'Could not mark the twig_templates cache type as enabled: ' . $exception->getMessage()
            );
        }

        return $this;
    }

    /**
     * @inheritDoc
     */
    public static function getDependencies(): array
    {
        return [];
    }

    /**
     * @inheritDoc
     */
    public function getAliases(): array
    {
        return [];
    }
}
