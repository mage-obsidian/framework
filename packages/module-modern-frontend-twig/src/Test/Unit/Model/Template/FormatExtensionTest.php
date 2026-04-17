<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Filter\StripTags;
use Magento\Framework\Locale\LocaleFormatter;
use Magento\Framework\Stdlib\DateTime\TimezoneInterface;
use Magento\Framework\UrlInterface;
use Magento\Store\Model\ScopeInterface;
use Magento\Store\Model\Store;
use Magento\Store\Model\StoreManagerInterface;
use MageObsidian\ModernFrontendTwig\Model\Template\Extension\FormatExtension;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Loader\ArrayLoader;

/**
 * Renders real Twig with the FormatExtension and mocked Magento services to lock
 * in the framework-level formatting helpers: locale numbers/dates, strip_tags,
 * config, url and media_url. Asserts the escaping contract — plain-text helpers
 * are NOT marked safe (Twig escapes them). Needs Twig + Magento types, so it
 * runs in a real Magento root (see phpunit.ci.xml).
 */
class FormatExtensionTest extends TestCase
{
    private LocaleFormatter&MockObject $localeFormatter;
    private TimezoneInterface&MockObject $timezone;
    private StripTags&MockObject $stripTags;
    private ScopeConfigInterface&MockObject $scopeConfig;
    private UrlInterface&MockObject $url;
    private StoreManagerInterface&MockObject $storeManager;

    protected function setUp(): void
    {
        if (!class_exists(Environment::class)) {
            $this->markTestSkipped('Twig is not installed in this runtime.');
        }
        $this->localeFormatter = $this->createMock(LocaleFormatter::class);
        $this->timezone = $this->createMock(TimezoneInterface::class);
        $this->stripTags = $this->createMock(StripTags::class);
        $this->scopeConfig = $this->createMock(ScopeConfigInterface::class);
        $this->url = $this->createMock(UrlInterface::class);
        $this->storeManager = $this->createMock(StoreManagerInterface::class);
    }

    private function render(string $template, array $context = []): string
    {
        $environment = new Environment(new ArrayLoader(['t' => $template]), ['cache' => false, 'autoescape' => 'html']);
        $environment->addExtension(new FormatExtension(
            $this->localeFormatter,
            $this->timezone,
            $this->stripTags,
            $this->scopeConfig,
            $this->url,
            $this->storeManager
        ));

        return $environment->render('t', $context);
    }

    public function testNumberFilterDelegatesToLocaleFormatter(): void
    {
        $this->localeFormatter->method('formatNumber')->with(1234.5)->willReturn('1,234.5');

        $this->assertStringContainsString('1,234.5', $this->render('{{ 1234.5|number }}'));
    }

    public function testNumberFilterToleratesNull(): void
    {
        $this->assertSame('', trim($this->render('{{ missing|number }}')));
    }

    public function testStripTagsFilterDelegatesAndStaysEscaped(): void
    {
        // strip_tags removes markup but the remainder can still carry & or < —
        // it must NOT be marked safe, so Twig escapes the result.
        $this->stripTags->method('filter')->willReturn('Tom & Jerry');

        $output = $this->render('{{ "<b>Tom & Jerry</b>"|strip_tags }}');

        $this->assertStringContainsString('Tom &amp; Jerry', $output);
        $this->assertStringNotContainsString('Tom & Jerry</', $output);
    }

    public function testConfigFunctionReadsStoreScope(): void
    {
        $this->scopeConfig->method('getValue')
            ->with('web/secure/base_url', ScopeInterface::SCOPE_STORE)
            ->willReturn('https://shop.test/');

        $this->assertStringContainsString('https://shop.test/', $this->render("{{ config('web/secure/base_url') }}"));
    }

    public function testUrlFunctionPassesRouteParams(): void
    {
        $this->url->method('getUrl')
            ->with('catalog/product/view', ['id' => 1])
            ->willReturn('https://shop.test/p/1');

        $this->assertStringContainsString('https://shop.test/p/1', $this->render("{{ url('catalog/product/view', { id: 1 }) }}"));
    }

    public function testMediaUrlFunctionPrefixesStoreMediaBase(): void
    {
        $store = $this->createMock(Store::class);
        $store->method('getBaseUrl')->with(UrlInterface::URL_TYPE_MEDIA)->willReturn('https://shop.test/media/');
        $this->storeManager->method('getStore')->willReturn($store);

        $this->assertStringContainsString('https://shop.test/media/catalog/x.jpg', $this->render("{{ media_url('catalog/x.jpg') }}"));
    }

    public function testDateFormatFilterDelegatesToTimezone(): void
    {
        $date = new \DateTime('2026-01-15 10:00:00');
        $this->timezone->method('date')->willReturn($date);
        $this->timezone->method('formatDateTime')->willReturn('Jan 15, 2026');

        $this->assertStringContainsString('Jan 15, 2026', $this->render("{{ d|date_format('medium') }}", ['d' => '2026-01-15']));
    }
}
