<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Cache;

use Magento\Framework\App\Cache\State;
use Magento\Framework\App\DeploymentConfig;
use MageObsidian\ModernFrontendTwig\Model\Cache\CacheTypeState;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;
use PHPUnit\Framework\TestCase;

/**
 * The distinction that matters here is between a cache type nobody has ever
 * configured — every install older than this feature — and one an operator
 * switched off. Only the second may stop the caching.
 */
class CacheTypeStateTest extends TestCase
{
    private function state(mixed $configured): CacheTypeState
    {
        $deploymentConfig = $this->createMock(DeploymentConfig::class);
        $deploymentConfig->method('get')
            ->with(State::CACHE_KEY . '/' . CompiledTemplates::TYPE_IDENTIFIER)
            ->willReturn($configured);

        return new CacheTypeState($deploymentConfig);
    }

    public function testAnUpgradedInstallKeepsCaching(): void
    {
        $this->assertTrue($this->state(null)->isCompilationCacheEnabled());
    }

    public function testHonoursAnExplicitDisable(): void
    {
        $this->assertFalse($this->state(0)->isCompilationCacheEnabled());
    }

    public function testHonoursAnExplicitEnable(): void
    {
        $this->assertTrue($this->state(1)->isCompilationCacheEnabled());
    }
}
