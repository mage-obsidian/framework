<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\Component\ComponentRegistrar;
use Magento\Framework\Component\ComponentRegistrarInterface;
use Magento\Framework\View\Design\Theme\ThemeProviderInterface;
use Magento\Framework\View\Design\ThemeInterface;
use Magento\Framework\View\DesignInterface;
use Magento\Framework\View\FileSystem as ViewFileSystem;
use MageObsidian\ModernFrontendTwig\Model\Template\TemplateHierarchy;
use PHPUnit\Framework\TestCase;
use Twig\Error\LoaderError;

/**
 * `@parent` exists to break the self-reference a theme override would otherwise
 * create, so the behaviour under test is which level each copy of the same
 * template points at — and that a module template, having nothing above it,
 * fails with something a developer can act on.
 */
class TemplateHierarchyTest extends TestCase
{
    private const string TEMPLATE = 'Acme_Demo::html/x.twig';

    private string $root;

    private string $childPath;

    private string $basePath;

    private string $modulePath;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/mage-obsidian-hierarchy-' . uniqid('', true);

        $this->childPath = $this->write('themes/frontend/Acme/child/Acme_Demo/templates/html/x.twig', 'child');
        $this->basePath = $this->write('themes/frontend/Acme/base/Acme_Demo/templates/html/x.twig', 'base');
        $this->modulePath = $this->write('modules/Acme_Demo/view/frontend/templates/html/x.twig', 'module');
    }

    protected function tearDown(): void
    {
        foreach ([$this->childPath, $this->basePath, $this->modulePath] as $file) {
            @unlink($file);
        }
        $this->removeTree($this->root);
    }

    private function write(string $relative, string $contents): string
    {
        $path = $this->root . '/' . $relative;
        @mkdir(dirname($path), 0o777, true);
        file_put_contents($path, $contents);

        return $path;
    }

    private function removeTree(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        foreach (scandir($directory) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $directory . '/' . $entry;
            is_dir($path) ? $this->removeTree($path) : @unlink($path);
        }
        @rmdir($directory);
    }

    private function theme(string $fullPath, ?ThemeInterface $parent): ThemeInterface
    {
        $theme = $this->createMock(ThemeInterface::class);
        $theme->method('getFullPath')->willReturn($fullPath);
        $theme->method('getParentTheme')->willReturn($parent);

        return $theme;
    }

    private function hierarchy(?ViewFileSystem $viewFileSystem = null): TemplateHierarchy
    {
        $base = $this->theme('frontend/Acme/base', null);
        $child = $this->theme('frontend/Acme/child', $base);
        $child->method('getInheritedThemes')->willReturn([$base, $child]);

        $design = $this->createMock(DesignInterface::class);
        $design->method('getDesignTheme')->willReturn($child);
        $design->method('getArea')->willReturn('frontend');

        $registrar = $this->createMock(ComponentRegistrarInterface::class);
        $registrar->method('getPath')->willReturnCallback(
            fn(string $type, string $name): ?string => match ([$type, $name]) {
                [ComponentRegistrar::THEME, 'frontend/Acme/child'] => $this->root . '/themes/frontend/Acme/child',
                [ComponentRegistrar::THEME, 'frontend/Acme/base'] => $this->root . '/themes/frontend/Acme/base',
                [ComponentRegistrar::MODULE, 'Acme_Demo'] => $this->root . '/modules/Acme_Demo',
                default => null,
            }
        );
        $registrar->method('getPaths')->willReturn(['Acme_Demo' => $this->root . '/modules/Acme_Demo']);

        $provider = $this->createMock(ThemeProviderInterface::class);
        $provider->method('getThemeByFullPath')->willReturnCallback(
            fn(string $fullPath): ?ThemeInterface => $fullPath === 'frontend/Acme/base' ? $base : null
        );

        return new TemplateHierarchy(
            $design,
            $registrar,
            $viewFileSystem ?? $this->createMock(ViewFileSystem::class),
            $provider
        );
    }

    public function testAChildThemeOverridePointsAtItsParentTheme(): void
    {
        $rewritten = $this->hierarchy()->rewrite("{% extends '@parent' %}", $this->childPath);

        $this->assertSame(
            "{% extends '@from:frontend/Acme/base:" . self::TEMPLATE . "' %}",
            $rewritten
        );
    }

    public function testTheMostBaseThemePointsAtTheModuleCopy(): void
    {
        $rewritten = $this->hierarchy()->rewrite('{% extends "@parent" %}', $this->basePath);

        $this->assertSame(
            '{% extends "@from:' . TemplateHierarchy::MODULE_TARGET . ':' . self::TEMPLATE . '" %}',
            $rewritten
        );
    }

    public function testTheSameLiteralResolvesToADifferentLevelPerCopy(): void
    {
        $hierarchy = $this->hierarchy();

        $this->assertNotSame(
            $hierarchy->rewrite("{% extends '@parent' %}", $this->childPath),
            $hierarchy->rewrite("{% extends '@parent' %}", $this->basePath)
        );
    }

    public function testAModuleTemplateHasNothingAboveIt(): void
    {
        $this->expectException(LoaderError::class);
        $this->expectExceptionMessageMatches('/no copy above it/i');

        $this->hierarchy()->rewrite("{% extends '@parent' %}", $this->modulePath);
    }

    public function testSourceWithoutTheKeywordIsUntouched(): void
    {
        $source = '<div>{{ label }}</div>';

        $this->assertSame($source, $this->hierarchy()->rewrite($source, $this->childPath));
    }

    public function testAWordContainingTheKeywordIsNotRewritten(): void
    {
        $source = "{% include '@parental/x.twig' %}{{ parent() }}";

        $this->assertSame($source, $this->hierarchy()->rewrite($source, $this->childPath));
    }

    public function testResolvingAModuleTargetReturnsTheModuleCopy(): void
    {
        $name = TemplateHierarchy::FROM_PREFIX . TemplateHierarchy::MODULE_TARGET . ':' . self::TEMPLATE;

        $this->assertSame($this->modulePath, $this->hierarchy()->resolveLevelled($name));
    }

    public function testResolvingAThemeTargetGoesThroughTheFallbackWithThatTheme(): void
    {
        $viewFileSystem = $this->createMock(ViewFileSystem::class);
        $viewFileSystem->expects($this->once())
            ->method('getTemplateFileName')
            ->with(
                self::TEMPLATE,
                $this->callback(
                    static fn(array $params): bool => ($params['themeModel'] ?? null) instanceof ThemeInterface
                )
            )
            ->willReturn($this->basePath);

        $name = TemplateHierarchy::FROM_PREFIX . 'frontend/Acme/base:' . self::TEMPLATE;

        $this->assertSame($this->basePath, $this->hierarchy($viewFileSystem)->resolveLevelled($name));
    }

    public function testResolvingAnUnknownTargetYieldsNothing(): void
    {
        $name = TemplateHierarchy::FROM_PREFIX . 'frontend/Other/theme:' . self::TEMPLATE;

        $this->assertNull($this->hierarchy()->resolveLevelled($name));
    }

    public function testTheTemplateIsSplitOffAtTheLevelSeparatorNotTheModuleOne(): void
    {
        $hierarchy = $this->hierarchy();

        $this->assertSame(
            self::TEMPLATE,
            $hierarchy->templateOf(TemplateHierarchy::FROM_PREFIX . 'frontend/Acme/base:' . self::TEMPLATE)
        );
        $this->assertSame(self::TEMPLATE, $hierarchy->templateOf(self::TEMPLATE));
    }

    public function testOnlyLevelledNamesAreRecognised(): void
    {
        $hierarchy = $this->hierarchy();

        $this->assertTrue($hierarchy->isLevelled(TemplateHierarchy::FROM_PREFIX . 'module:' . self::TEMPLATE));
        $this->assertFalse($hierarchy->isLevelled(self::TEMPLATE));
        $this->assertFalse($hierarchy->isLevelled(TemplateHierarchy::PARENT));
    }
}
