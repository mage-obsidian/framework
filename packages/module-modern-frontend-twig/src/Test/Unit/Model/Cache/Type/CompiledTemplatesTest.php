<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Cache\Type;

use Magento\Framework\App\Cache\Type\FrontendPool;
use Magento\Framework\Cache\FrontendInterface;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Zend_Cache;

/**
 * `bin/magento cache:clean twig_templates` and the admin grid both reach the
 * compiled templates through this type's clean().
 */
class CompiledTemplatesTest extends TestCase
{
    private CompiledTemplateCache&MockObject $compiledTemplateCache;

    protected function setUp(): void
    {
        $this->compiledTemplateCache = $this->createMock(CompiledTemplateCache::class);
    }

    private function type(): CompiledTemplates
    {
        $pool = $this->createMock(FrontendPool::class);
        $pool->method('get')
            ->with(CompiledTemplates::TYPE_IDENTIFIER)
            ->willReturn($this->createMock(FrontendInterface::class));

        return new CompiledTemplates($pool, $this->compiledTemplateCache);
    }

    public function testCleaningTheTypeRemovesTheCompiledTemplates(): void
    {
        $this->compiledTemplateCache->expects($this->once())->method('clear');

        $this->type()->clean();
    }

    public function testATagScopedCleanLeavesTheCompiledTemplatesAlone(): void
    {
        $this->compiledTemplateCache->expects($this->never())->method('clear');

        $this->type()->clean(Zend_Cache::CLEANING_MODE_MATCHING_TAG, ['CATALOG_PRODUCT']);
    }

    public function testCarriesItsOwnTag(): void
    {
        $this->assertSame(CompiledTemplates::CACHE_TAG, $this->type()->getTag());
    }
}
