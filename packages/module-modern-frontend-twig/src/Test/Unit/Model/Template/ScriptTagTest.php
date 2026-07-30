<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\View\Helper\SecureHtmlRenderer;
use MageObsidian\ModernFrontend\ViewModel\ViteResolver;
use MageObsidian\ModernFrontendTwig\Model\Template\ScriptTag;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class ScriptTagTest extends TestCase
{
    private ViteResolver&MockObject $viteResolver;

    private SecureHtmlRenderer&MockObject $secureRenderer;

    private ScriptTag $scriptTag;

    protected function setUp(): void
    {
        $this->viteResolver = $this->createMock(ViteResolver::class);
        $this->secureRenderer = $this->createMock(SecureHtmlRenderer::class);
        $this->scriptTag = new ScriptTag($this->viteResolver, $this->secureRenderer);
    }

    public function testItResolvesThePathThroughViteAndRendersAModuleTag(): void
    {
        $this->viteResolver->expects($this->once())
            ->method('getViteFileUrl')
            ->with('Vendor_Module::js/thing')
            ->willReturn('https://shop.test/static/generated/js/thing.js');

        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with(
                'script',
                ['type' => 'module', 'src' => 'https://shop.test/static/generated/js/thing.js'],
                '',
                false
            )
            ->willReturn('<script type="module" src="…" nonce="abc"></script>');

        $this->assertSame(
            '<script type="module" src="…" nonce="abc"></script>',
            $this->scriptTag->module('Vendor_Module::js/thing')
        );
    }

    public function testItGoesThroughTheSecureRendererSoTheTagCarriesANonce(): void
    {
        $this->viteResolver->method('getViteFileUrl')->willReturn('/x.js');
        $this->secureRenderer->expects($this->once())->method('renderTag');

        $this->scriptTag->module('Vendor_Module::js/x');
    }
}
