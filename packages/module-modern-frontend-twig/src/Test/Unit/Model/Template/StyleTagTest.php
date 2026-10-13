<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\View\Helper\SecureHtmlRenderer;
use MageObsidian\ModernFrontend\Service\Csp\InlineStylePolicy;
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
        $this->styleTag = new StyleTag($this->secureRenderer, $this->policy(false));
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

    public function testItBuildsOneStylesheetFromEverySelector(): void
    {
        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with('style', [], '.a{color:red}.b{width:40%}', false)
            ->willReturn('<style>…</style>');

        $this->assertSame(
            '<style>…</style>',
            $this->styleTag->rules(['.a' => 'color:red', '.b' => ' width:40%; '])
        );
    }

    public function testItSkipsARuleWithNoSelectorOrNoDeclarations(): void
    {
        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with('style', [], '.a{color:red}', false)
            ->willReturn('<style>.a{color:red}</style>');

        $this->assertSame(
            '<style>.a{color:red}</style>',
            $this->styleTag->rules(['.a' => 'color:red', ' ' => 'color:blue', '.b' => '   '])
        );
    }

    public function testARuleSetWithNothingInItEmitsNoElement(): void
    {
        $this->secureRenderer->expects($this->never())->method('renderTag');

        $this->assertSame('', $this->styleTag->rules(['.a' => '', '.b' => ';']));
    }

    public function testItEmitsNothingForAnEmptyStylesheet(): void
    {
        $this->secureRenderer->expects($this->never())->method('renderTag');

        $this->assertSame('', $this->styleTag->inline("  \n "));
    }

    public function testAPageThatAllowsInlineStylesAdoptsTheSheetFromANoncedScriptInstead(): void
    {
        $captured = null;
        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with('script', [], $this->callback(function (string $js) use (&$captured): bool {
                $captured = $js;

                return true;
            }), false)
            ->willReturn('<script>…</script>');

        $styleTag = new StyleTag($this->secureRenderer, $this->policy(true));

        $this->assertSame('<script>…</script>', $styleTag->inline('[v-cloak]{display:none}', ['data-type' => 'criticalCss']));
        $this->assertStringContainsString('adoptedStyleSheets', $captured);
        $this->assertStringContainsString('"[v-cloak]{display:none}"', $captured);
        $this->assertStringContainsString('{"data-type":"criticalCss"}', $captured);
    }

    public function testAnAdoptedSheetCannotCloseTheScriptItTravelsIn(): void
    {
        $captured = null;
        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with('script', [], $this->callback(function (string $js) use (&$captured): bool {
                $captured = $js;

                return true;
            }), false)
            ->willReturn('');

        (new StyleTag($this->secureRenderer, $this->policy(true)))->inline('a::after{content:"</script><b>"}');

        $this->assertStringNotContainsString('</script>', $captured);
        $this->assertStringNotContainsString('<b>', $captured);
    }

    public function testPerElementRulesFollowThePageToo(): void
    {
        $this->secureRenderer->expects($this->once())
            ->method('renderTag')
            ->with('script', [], $this->stringContains('.a{color:red}'), false)
            ->willReturn('<script>…</script>');

        $this->assertSame(
            '<script>…</script>',
            (new StyleTag($this->secureRenderer, $this->policy(true)))->rules(['.a' => 'color:red'])
        );
    }

    private function policy(bool $allowsInline): InlineStylePolicy
    {
        $policy = $this->createStub(InlineStylePolicy::class);
        $policy->method('allowsInlineStyles')->willReturn($allowsInline);

        return $policy;
    }
}
