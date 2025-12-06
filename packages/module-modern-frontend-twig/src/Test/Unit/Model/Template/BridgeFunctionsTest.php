<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use LogicException;
use MageObsidian\ModernFrontendTwig\Model\Template\BridgeFunctions;
use PHPUnit\Framework\TestCase;

/**
 * Pure unit test for the Twig→block delegations. Needs neither Magento nor
 * Twig, so it runs in the standalone CI suite. The block is a duck-typed stub.
 */
class BridgeFunctionsTest extends TestCase
{
    private BridgeFunctions $bridge;

    protected function setUp(): void
    {
        $this->bridge = new BridgeFunctions();
    }

    public function testRenderVueDelegatesWithComponentNameAndProps(): void
    {
        $block = new class {
            public array $lastCall = [];
            public function renderVueComponent(string $name, array $props = []): string
            {
                $this->lastCall = [$name, $props];
                return '<div data-island="' . $name . '"></div>';
            }
        };

        $html = $this->bridge->renderVue($block, 'Vendor::Card', ['label' => 'Hi']);

        $this->assertSame('<div data-island="Vendor::Card"></div>', $html);
        $this->assertSame(['Vendor::Card', ['label' => 'Hi']], $block->lastCall);
    }

    public function testChildHtmlDelegatesAliasAndCacheFlag(): void
    {
        $block = new class {
            public array $lastCall = [];
            public function getChildHtml(string $alias = '', bool $useCache = true): string
            {
                $this->lastCall = [$alias, $useCache];
                return 'child';
            }
        };

        $this->assertSame('child', $this->bridge->childHtml($block, 'footer', false));
        $this->assertSame(['footer', false], $block->lastCall);
    }

    public function testHeroIconDelegatesWithDefaults(): void
    {
        $block = new class {
            public array $lastCall = [];
            public function getHeroIcon(string $name, string $set = 'solid', string $size = '24'): string
            {
                $this->lastCall = [$name, $set, $size];
                return 'svg';
            }
        };

        $this->assertSame('svg', $this->bridge->heroIcon($block, 'check'));
        $this->assertSame(['check', 'solid', '24'], $block->lastCall);
    }

    public function testJsonLdDelegatesTypeAndData(): void
    {
        $block = new class {
            public array $lastCall = [];
            public function renderJsonLd(string $type, array $data = []): string
            {
                $this->lastCall = [$type, $data];
                return '<script type="application/ld+json">{}</script>';
            }
        };

        $html = $this->bridge->jsonLd($block, 'FAQPage', ['mainEntity' => []]);

        $this->assertSame('<script type="application/ld+json">{}</script>', $html);
        $this->assertSame(['FAQPage', ['mainEntity' => []]], $block->lastCall);
    }

    public function testJsonLdThrowsActionableErrorOnUnsupportedBlock(): void
    {
        $block = new class {
            public function getChildHtml(string $alias = '', bool $useCache = true): string
            {
                return '';
            }
        };

        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/json_ld.*renderJsonLd/');
        $this->bridge->jsonLd($block, 'FAQPage');
    }

    public function testImageDelegatesSrcAndOptions(): void
    {
        $block = new class {
            public array $lastCall = [];
            public function renderImage(string $src, array $options = []): string
            {
                $this->lastCall = [$src, $options];
                return '<img src="' . $src . '">';
            }
        };

        $html = $this->bridge->image($block, 'Acme::a.jpg', ['width' => 100, 'height' => 80]);

        $this->assertSame('<img src="Acme::a.jpg">', $html);
        $this->assertSame(['Acme::a.jpg', ['width' => 100, 'height' => 80]], $block->lastCall);
    }

    public function testImageThrowsActionableErrorOnUnsupportedBlock(): void
    {
        $block = new class {
            public function getChildHtml(string $alias = '', bool $useCache = true): string
            {
                return '';
            }
        };

        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/image.*renderImage/');
        $this->bridge->image($block, 'Acme::a.jpg');
    }

    public function testUrlHelpersDelegate(): void
    {
        $block = new class {
            public function getViteFileUrl(string $path): string
            {
                return '/static/' . $path;
            }
            public function resolveComponentPath(string $name): string
            {
                return '/static/components/' . $name;
            }
            public function getViewFileUrl(string $fileId, array $params = []): string
            {
                return '/view/' . $fileId;
            }
        };

        $this->assertSame('/static/lib/vue.js', $this->bridge->viteUrl($block, 'lib/vue.js'));
        $this->assertSame('/static/components/Vendor::Card', $this->bridge->componentPath($block, 'Vendor::Card'));
        $this->assertSame('/view/logo.svg', $this->bridge->viewFileUrl($block, 'logo.svg'));
    }

    public function testRenderVueThrowsActionableErrorOnUnsupportedBlock(): void
    {
        // A block without renderVueComponent (mimics a core Magento block).
        $block = new class {
            public function getChildHtml(string $alias = '', bool $useCache = true): string
            {
                return '';
            }
        };

        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/render_vue.*renderVueComponent/');
        $this->bridge->renderVue($block, 'Vendor::Card');
    }
}
