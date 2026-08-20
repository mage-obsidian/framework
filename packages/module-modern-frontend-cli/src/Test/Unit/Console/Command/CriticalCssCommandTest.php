<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Test\Unit\Console\Command;

use MageObsidian\ModernFrontendCli\Console\Command\CriticalCssCommand;
use PHPUnit\Framework\TestCase;

class CriticalCssCommandTest extends TestCase
{
    private function command(): CriticalCssCommand
    {
        return (new \ReflectionClass(CriticalCssCommand::class))->newInstanceWithoutConstructor();
    }

    private function page(string $bodyClass): string
    {
        return "<html><head></head><body data-container=\"body\" class=\"{$bodyClass}\"><h1>x</h1></body></html>";
    }

    public function testAcceptsThePageWhoseBodyCarriesTheHandle(): void
    {
        $html = $this->page('checkout-index-index page-layout-1column');

        $this->assertTrue($this->command()->servesHandle($html, 'checkout_index_index'));
    }

    public function testRejectsAPageThatRedirectedToAnotherHandle(): void
    {
        $html = $this->page('checkout-cart-index page-layout-1column');

        $this->assertFalse($this->command()->servesHandle($html, 'checkout_index_index'));
    }

    public function testDoesNotMatchAHandleThatIsMerelyAPrefixOfAClass(): void
    {
        $html = $this->page('checkout-index-index-something');

        $this->assertFalse($this->command()->servesHandle($html, 'checkout_index_index'));
    }

    public function testReadsSingleQuotedAndMultilineBodyTags(): void
    {
        $html = "<body data-container=\"body\"\n        class='cms-home cms-index-index page-layout-1column'>";

        $this->assertTrue($this->command()->servesHandle($html, 'cms_index_index'));
    }

    public function testAcceptsMarkupWithoutABodyClassRatherThanBlockingTheRun(): void
    {
        $this->assertTrue($this->command()->servesHandle('<html><body></body></html>', 'cms_index_index'));
        $this->assertTrue($this->command()->servesHandle('no markup at all', 'cms_index_index'));
        $this->assertTrue($this->command()->servesHandle($this->page(''), 'cms_index_index'));
    }
}
