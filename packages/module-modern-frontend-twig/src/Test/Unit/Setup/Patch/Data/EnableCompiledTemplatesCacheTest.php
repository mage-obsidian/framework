<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Setup\Patch\Data;

use Magento\Framework\App\Cache\Manager;
use Magento\Framework\App\DeploymentConfig;
use Magento\Framework\Exception\FileSystemException;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;
use MageObsidian\ModernFrontendTwig\Setup\Patch\Data\EnableCompiledTemplatesCache;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class EnableCompiledTemplatesCacheTest extends TestCase
{
    private Manager&MockObject $cacheManager;
    private LoggerInterface&MockObject $logger;

    protected function setUp(): void
    {
        $this->cacheManager = $this->createMock(Manager::class);
        $this->logger = $this->createMock(LoggerInterface::class);
    }

    private function patch(mixed $configured): EnableCompiledTemplatesCache
    {
        $deploymentConfig = $this->createMock(DeploymentConfig::class);
        $deploymentConfig->method('get')->willReturn($configured);

        return new EnableCompiledTemplatesCache($this->cacheManager, $deploymentConfig, $this->logger);
    }

    public function testEnablesTheTypeOnAnInstallThatPredatesIt(): void
    {
        $this->cacheManager->expects($this->once())
            ->method('setEnabled')
            ->with([CompiledTemplates::TYPE_IDENTIFIER], true);

        $this->patch(null)->apply();
    }

    public function testLeavesAnOperatorsChoiceAlone(): void
    {
        $this->cacheManager->expects($this->never())->method('setEnabled');

        $this->patch(0)->apply();
    }

    public function testAReadOnlyEnvFileDoesNotBreakTheUpgrade(): void
    {
        $this->cacheManager->method('setEnabled')
            ->willThrowException(new FileSystemException(__('read-only')));
        $this->logger->expects($this->once())->method('warning');

        $this->patch(null)->apply();
    }
}
