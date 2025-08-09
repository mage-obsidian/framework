<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\Escaper;
use MageObsidian\ModernFrontendTwig\Model\Template\BridgeFunctions;
use MageObsidian\ModernFrontendTwig\Model\Template\Extension\MageObsidianExtension;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Loader\ArrayLoader;

/**
 * Renders real Twig with the MageObsidian extension to lock in the two
 * behaviours that matter: HTML auto-escaping is on by default, and the
 * markup-emitting helpers are NOT escaped. Needs the Twig library and the
 * Magento Escaper type, so it is excluded from the standalone CI suite and runs
 * inside a Magento root (see phpunit.ci.xml), like the core ViteResolverTest.
 */
class TwigRenderTest extends TestCase
{
    protected function setUp(): void
    {
        if (!class_exists(Environment::class)) {
            $this->markTestSkipped('Twig is not installed in this runtime.');
        }
    }

    private function buildEnvironment(array $templates): Environment
    {
        $escaper = $this->createMock(Escaper::class);
        $escaper->method('escapeUrl')->willReturnCallback(static fn($v): string => 'URL(' . $v . ')');

        $environment = new Environment(new ArrayLoader($templates), ['cache' => false, 'autoescape' => 'html']);
        $environment->addExtension(new MageObsidianExtension(new BridgeFunctions(), $escaper));

        return $environment;
    }

    private function blockStub(): object
    {
        return new class {
            public function renderVueComponent(string $name, array $props = []): string
            {
                return '<div data-island="' . $name . '">' . json_encode($props) . '</div>';
            }
        };
    }

    public function testInterpolatedValuesAreHtmlEscapedByDefault(): void
    {
        $environment = $this->buildEnvironment(['t' => '{{ value }}']);

        $output = $environment->render('t', ['value' => '<script>alert(1)</script>']);

        $this->assertStringNotContainsString('<script>', $output);
        $this->assertStringContainsString('&lt;script&gt;', $output);
    }

    public function testRenderVueOutputIsNotEscaped(): void
    {
        $environment = $this->buildEnvironment(['t' => "{{ render_vue('Vendor::Card', { label: 'Hi' }) }}"]);

        $output = $environment->render('t', ['block' => $this->blockStub()]);

        $this->assertStringContainsString('<div data-island="Vendor::Card">', $output);
        $this->assertStringNotContainsString('&lt;div', $output);
    }

    public function testEscapeUrlFilterDelegatesToMagentoEscaper(): void
    {
        $environment = $this->buildEnvironment(['t' => '{{ "/p?a=1"|escape_url }}']);

        $this->assertStringContainsString('URL(/p?a=1)', $environment->render('t', []));
    }
}
