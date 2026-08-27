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
use MageObsidian\ModernFrontendTwig\Model\Template\StyleTag;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class StyleTagTest extends TestCase
{
    private SecureHtmlRenderer&MockObject $secureRenderer;

    private StyleTag $styleTag;

    protected function setUp(): void
    {
        $this->secureRenderer = $this->createMock(SecureHtmlRenderer::class);
        $this->styleTag = new StyleTag($this->secureRenderer);
    }

    public function testItRendersTheStylesheetThroughTheSecureRenderer(): void
    {
        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with('style', ['data-type' => 'criticalCss'], '[v-cloak]{display:none}', false)
            ->willReturn('<style data-type="criticalCss">[v-cloak]{display:none}</style>');

        $this->assertSame(
            '<style data-type="criticalCss">[v-cloak]{display:none}</style>',
            $this->styleTag->inline('[v-cloak]{display:none}', ['data-type' => 'criticalCss'])
        );
    }

    public function testItEmitsNothingForAnEmptyStylesheet(): void
    {
        $this->secureRenderer->expects($this->never())->method('renderTag');

        $this->assertSame('', $this->styleTag->inline("  \n "));
    }
}
