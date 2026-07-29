<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\Escaper;
use Magento\Framework\Phrase;
use Magento\Framework\Phrase\Renderer\Placeholder;
use MageObsidian\ModernFrontend\Service\Vue\IslandMarkup;
use MageObsidian\ModernFrontendTwig\Model\Template\BridgeFunctions;
use MageObsidian\ModernFrontendTwig\Model\Template\ViewFileInliner;
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
        $environment->addExtension(new MageObsidianExtension(
            new BridgeFunctions(),
            $escaper,
            new IslandMarkup(),
            $this->createMock(ViewFileInliner::class)
        ));

        return $environment;
    }

    private function blockStub(): object
    {
        return new class {
            public function renderVueComponent(string $name, array $props = [], bool $eager = false): string
            {
                return '<div data-island="' . $name . '" data-eager="' . ($eager ? '1' : '0') . '">'
                    . json_encode($props) . '</div>';
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

        $this->assertStringContainsString('<div data-island="Vendor::Card"', $output);
        $this->assertStringContainsString('data-eager="0"', $output);
        $this->assertStringNotContainsString('&lt;div', $output);
    }

    public function testRenderVueForwardsTheEagerFlag(): void
    {
        $environment = $this->buildEnvironment(['t' => "{{ render_vue('Vendor::Card', {}, true) }}"]);

        $output = $environment->render('t', ['block' => $this->blockStub()]);

        $this->assertStringContainsString('data-eager="1"', $output);
    }

    public function testEscapeUrlFilterDelegatesToMagentoEscaper(): void
    {
        $environment = $this->buildEnvironment(['t' => '{{ "/p?a=1"|escape_url }}']);

        $this->assertStringContainsString('URL(/p?a=1)', $environment->render('t', []));
    }

    /**
     * escape_url already HTML-escapes its result (escapeUrl wraps htmlspecialchars);
     * the filter must be flagged safe so the html autoescaper does not escape the
     * ampersand a second time and break multi-parameter URLs (e.g. layered nav).
     */
    public function testEscapeUrlOutputIsNotDoubleEscaped(): void
    {
        $escaper = $this->createMock(Escaper::class);
        $escaper->method('escapeUrl')
            ->willReturnCallback(static fn($v): string => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'));
        $environment = new Environment(
            new ArrayLoader(['t' => '{{ "/c?cat=3&q=bag"|escape_url }}']),
            ['cache' => false, 'autoescape' => 'html']
        );
        $environment->addExtension(new MageObsidianExtension(
            new BridgeFunctions(),
            $escaper,
            new IslandMarkup(),
            $this->createMock(ViewFileInliner::class)
        ));

        $output = $environment->render('t', []);

        $this->assertStringContainsString('cat=3&amp;q=bag', $output);
        $this->assertStringNotContainsString('&amp;amp;', $output);
    }

    public function testInlineViewFileEmitsTheFileVerbatim(): void
    {
        $inliner = $this->createMock(ViewFileInliner::class);
        $inliner->method('inline')
            ->with('Magento_Theme::css/view-transitions.css')
            ->willReturn('::view-transition-old(root) { animation: none; }');

        $environment = new Environment(
            new ArrayLoader(['t' => "{{ inline_view_file('Magento_Theme::css/view-transitions.css') }}"]),
            ['cache' => false, 'autoescape' => 'html']
        );
        $environment->addExtension(
            new MageObsidianExtension(new BridgeFunctions(), $this->createMock(Escaper::class), new IslandMarkup(), $inliner)
        );

        $this->assertSame('::view-transition-old(root) { animation: none; }', $environment->render('t', []));
    }

    public function testTranslateFunctionReturnsTextWhenNoPlaceholders(): void
    {
        $environment = $this->buildEnvironment(['t' => "{{ __('Skip to Content') }}"]);

        $this->assertStringContainsString('Skip to Content', $environment->render('t', []));
    }

    public function testTranslateFunctionSubstitutesNumberedArguments(): void
    {
        // The numbered-placeholder renderer is what Magento registers at runtime;
        // set it explicitly so the substitution assertion is deterministic.
        $previous = $this->swapPhraseRenderer(new Placeholder());

        try {
            $environment = $this->buildEnvironment(['t' => "{{ __('Items %1 to %2 of %3', first, last, total) }}"]);

            $output = $environment->render('t', ['first' => 1, 'last' => 20, 'total' => 57]);

            $this->assertStringContainsString('Items 1 to 20 of 57', $output);
        } finally {
            $this->swapPhraseRenderer($previous);
        }
    }

    public function testTranslateOutputIsHtmlEscaped(): void
    {
        $environment = $this->buildEnvironment(['t' => "{{ __('<b>%1</b>', value) }}"]);

        $output = $environment->render('t', ['value' => 'x']);

        $this->assertStringContainsString('&lt;b&gt;', $output);
        $this->assertStringNotContainsString('<b>', $output);
    }

    public function testIslandListWrapsAnAppliedLoopInFragmentAnchors(): void
    {
        $environment = $this->buildEnvironment([
            't' => "{% apply island_list %}{% for o in options %}<span>{{ o }}</span>{% endfor %}{% endapply %}",
        ]);

        $output = $environment->render('t', ['options' => ['28', '29']]);

        $this->assertSame('<!--[--><span>28</span><span>29</span><!--]-->', $output);
    }

    public function testIslandListDoesNotDoubleEscapeTheCapturedMarkup(): void
    {
        $environment = $this->buildEnvironment([
            't' => '{% apply island_list %}<span>{{ label }}</span>{% endapply %}',
        ]);

        $output = $environment->render('t', ['label' => 'R&D']);

        // The block's own interpolation is escaped once, by Twig, before the
        // filter ever sees it; the filter must not escape the markup again.
        $this->assertSame('<!--[--><span>R&amp;D</span><!--]-->', $output);
    }

    public function testIslandIfEmitsTheMarkupWhenTheConditionHolds(): void
    {
        $environment = $this->buildEnvironment([
            't' => '{% apply island_if(oldPrice) %}<b>{{ oldPrice }}</b>{% endapply %}',
        ]);

        $this->assertSame('<b>$59.00</b>', $environment->render('t', ['oldPrice' => '$59.00']));
    }

    public function testIslandIfEmitsVuesPlaceholderWhenTheConditionFails(): void
    {
        $environment = $this->buildEnvironment([
            't' => '{% apply island_if(oldPrice) %}<b>{{ oldPrice }}</b>{% endapply %}',
        ]);

        $this->assertSame('<!---->', $environment->render('t', ['oldPrice' => null]));
    }

    /**
     * Swap the process-wide Phrase renderer and return the previous one so the
     * caller can restore it, keeping global state leak-free under failOnRisky.
     */
    private function swapPhraseRenderer(?object $renderer): ?object
    {
        $property = new \ReflectionProperty(Phrase::class, 'renderer');
        $previous = $property->getValue();
        if ($renderer === null) {
            $property->setValue(null, null);
        } else {
            Phrase::setRenderer($renderer);
        }

        return $previous;
    }
}
