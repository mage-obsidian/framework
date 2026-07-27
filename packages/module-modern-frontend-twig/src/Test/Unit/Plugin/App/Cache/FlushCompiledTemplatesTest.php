<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Plugin\App\Cache;

use Magento\Framework\App\Cache\Manager;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use MageObsidian\ModernFrontendTwig\Model\Cache\Type\CompiledTemplates;
use MageObsidian\ModernFrontendTwig\Plugin\App\Cache\FlushCompiledTemplates;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * `cache:flush` must reach the compiled templates, but `cache:flush block_html`
 * must not — the user asked for one type.
 */
class FlushCompiledTemplatesTest extends TestCase
{
    private CompiledTemplateCache&MockObject $compiledTemplateCache;
    private FlushCompiledTemplates $plugin;

    protected function setUp(): void
    {
        $this->compiledTemplateCache = $this->createMock(CompiledTemplateCache::class);
        $this->plugin = new FlushCompiledTemplates($this->compiledTemplateCache);
    }

    public function testFlushingEveryTypeRemovesTheCompiledTemplates(): void
    {
        $this->compiledTemplateCache->expects($this->once())->method('clear');

        $this->plugin->afterFlush($this->createMock(Manager::class), null, []);
    }

    public function testFlushingTheTwigTypeRemovesTheCompiledTemplates(): void
    {
        $this->compiledTemplateCache->expects($this->once())->method('clear');

        $this->plugin->afterFlush(
            $this->createMock(Manager::class),
            null,
            ['block_html', CompiledTemplates::TYPE_IDENTIFIER]
        );
    }

    public function testFlushingAnUnrelatedTypeLeavesThemAlone(): void
    {
        $this->compiledTemplateCache->expects($this->never())->method('clear');

        $this->plugin->afterFlush($this->createMock(Manager::class), null, ['block_html']);
    }

    public function testPassesTheOriginalResultThrough(): void
    {
        $this->assertSame(
            'untouched',
            $this->plugin->afterFlush($this->createMock(Manager::class), 'untouched', [])
        );
    }
}
