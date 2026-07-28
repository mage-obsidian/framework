<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\View\FileSystem as ViewFileSystem;
use MageObsidian\ModernFrontendTwig\Model\Template\FilesystemLoader;
use MageObsidian\ModernFrontendTwig\Model\Template\TemplateHierarchy;
use MageObsidian\ModernFrontendTwig\Model\Template\TemplateNamespaces;
use PHPUnit\Framework\TestCase;
use Twig\Error\LoaderError;

/**
 * The loader is where the three ways of naming a template meet: an absolute path
 * (what Magento hands the engine), a module reference resolved through the theme
 * fallback, and the two namespaced forms. Each has to reach the right file, and
 * a name that reaches none has to say why.
 */
class FilesystemLoaderTest extends TestCase
{
    private string $file;

    protected function setUp(): void
    {
        $this->file = tempnam(sys_get_temp_dir(), 'mage-obsidian-loader');
        file_put_contents($this->file, '<p>{{ label }}</p>');
    }

    protected function tearDown(): void
    {
        @unlink($this->file);
    }

    private function loader(
        ?ViewFileSystem $viewFileSystem = null,
        ?TemplateNamespaces $namespaces = null,
        ?TemplateHierarchy $hierarchy = null
    ): FilesystemLoader {
        return new FilesystemLoader(
            $viewFileSystem ?? $this->createMock(ViewFileSystem::class),
            $namespaces ?? $this->createMock(TemplateNamespaces::class),
            $hierarchy ?? $this->passthroughHierarchy()
        );
    }

    private function passthroughHierarchy(): TemplateHierarchy
    {
        $hierarchy = $this->createMock(TemplateHierarchy::class);
        $hierarchy->method('rewrite')->willReturnCallback(static fn(string $code): string => $code);

        return $hierarchy;
    }

    private function resolvingTo(string $expectedName): ViewFileSystem
    {
        $viewFileSystem = $this->createMock(ViewFileSystem::class);
        $viewFileSystem->method('getTemplateFileName')
            ->willReturnCallback(fn(string $name): string|bool => $name === $expectedName ? $this->file : false);

        return $viewFileSystem;
    }

    private function expandingAlias(string $alias, string $expanded): TemplateNamespaces
    {
        $namespaces = $this->createMock(TemplateNamespaces::class);
        $namespaces->method('expand')
            ->willReturnCallback(static fn(string $name): ?string => $name === $alias ? $expanded : null);

        return $namespaces;
    }

    public function testAnAbsolutePathIsReadDirectly(): void
    {
        $source = $this->loader()->getSourceContext($this->file);

        $this->assertSame('<p>{{ label }}</p>', $source->getCode());
        $this->assertSame($this->file, $source->getPath());
    }

    public function testAModuleReferenceGoesThroughTheThemeFallback(): void
    {
        $loader = $this->loader($this->resolvingTo('Acme_Demo::html/x.twig'));

        $this->assertSame($this->file, $loader->getCacheKey('Acme_Demo::html/x.twig'));
    }

    public function testAnAliasIsExpandedBeforeTheFallback(): void
    {
        $loader = $this->loader(
            $this->resolvingTo('Acme_Demo::html/x.twig'),
            $this->expandingAlias('@demo/html/x.twig', 'Acme_Demo::html/x.twig')
        );

        $this->assertSame($this->file, $loader->getCacheKey('@demo/html/x.twig'));
    }

    public function testAnUnknownAliasIsReportedWithSuggestions(): void
    {
        $namespaces = $this->createMock(TemplateNamespaces::class);
        $namespaces->method('expand')->willReturn(null);
        $namespaces->method('suggest')->willReturn(['@demo']);

        $this->expectException(LoaderError::class);
        $this->expectExceptionMessage('Did you mean @demo?');

        $this->loader(null, $namespaces)->getCacheKey('@dmo/html/x.twig');
    }

    public function testALevelledNameBypassesTheFallback(): void
    {
        $viewFileSystem = $this->createMock(ViewFileSystem::class);
        $viewFileSystem->expects($this->never())->method('getTemplateFileName');

        $hierarchy = $this->createMock(TemplateHierarchy::class);
        $hierarchy->method('isLevelled')->willReturn(true);
        $hierarchy->method('resolveLevelled')->willReturn($this->file);

        $this->assertSame(
            $this->file,
            $this->loader($viewFileSystem, null, $hierarchy)->getCacheKey('@from:module:Acme_Demo::html/x.twig')
        );
    }

    public function testALevelledNameWithNoCopyAboveIsReported(): void
    {
        $hierarchy = $this->createMock(TemplateHierarchy::class);
        $hierarchy->method('isLevelled')->willReturn(true);
        $hierarchy->method('resolveLevelled')->willReturn(null);
        $hierarchy->method('templateOf')->willReturn('Acme_Demo::html/x.twig');

        $this->expectException(LoaderError::class);
        $this->expectExceptionMessage('Acme_Demo::html/x.twig');

        $this->loader(null, null, $hierarchy)->getCacheKey('@from:module:Acme_Demo::html/x.twig');
    }

    public function testTheSourceIsHandedToTheHierarchyForRewriting(): void
    {
        $hierarchy = $this->createMock(TemplateHierarchy::class);
        $hierarchy->expects($this->once())
            ->method('rewrite')
            ->with('<p>{{ label }}</p>', $this->file)
            ->willReturn('rewritten');

        $this->assertSame('rewritten', $this->loader(null, null, $hierarchy)->getSourceContext($this->file)->getCode());
    }

    public function testAnUnresolvableNameIsReported(): void
    {
        $this->expectException(LoaderError::class);
        $this->expectExceptionMessage('could not be resolved through the theme fallback');

        $this->loader()->getCacheKey('Acme_Demo::missing.twig');
    }

    public function testExistsAnswersFalseInsteadOfThrowing(): void
    {
        $this->assertFalse($this->loader()->exists('Acme_Demo::missing.twig'));
        $this->assertTrue($this->loader()->exists($this->file));
    }

    public function testFreshnessComparesTheResolvedFile(): void
    {
        $loader = $this->loader();

        $this->assertTrue($loader->isFresh($this->file, time() + 10));
        $this->assertFalse($loader->isFresh($this->file, filemtime($this->file) - 10));
    }
}
