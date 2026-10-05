<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Model\Cache;

use Magento\Framework\App\Cache\State;
use Magento\Framework\App\DeploymentConfig;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;

/**
 * Tells whether compiled templates may be cached.
 *
 * Not `App\Cache\StateInterface`, because it answers `false` for a cache type it
 * has never heard of — and `twig_templates` is unknown to every install that
 * predates it, since Magento only seeds the type states at `setup:install`. Read
 * through that interface, upgrading would silently turn compilation off and put
 * a full recompile on every request. Reading the raw deployment config instead
 * separates "never configured" from "switched off on purpose".
 */
class CacheTypeState
{
    /**
     * @param DeploymentConfig $deploymentConfig
     */
    public function __construct(
        private readonly DeploymentConfig $deploymentConfig
    ) {
    }

    /**
     * @return bool
     */
    public function isCompilationCacheEnabled(): bool
    {
        $configured = $this->deploymentConfig->get(
            State::CACHE_KEY . '/' . CompiledTemplates::TYPE_IDENTIFIER
        );

        return $configured === null || (bool)$configured;
    }
}
