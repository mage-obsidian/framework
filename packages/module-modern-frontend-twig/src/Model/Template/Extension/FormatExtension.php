<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template\Extension;

use IntlDateFormatter;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Filter\StripTags;
use Magento\Framework\Locale\LocaleFormatter;
use Magento\Framework\Stdlib\DateTime\TimezoneInterface;
use Magento\Framework\UrlInterface;
use Magento\Store\Model\ScopeInterface;
use Magento\Store\Model\StoreManagerInterface;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;

/**
 * Framework-level formatting helpers for Twig, backed by Magento services (not by
 * the rendering block, unlike the bridge helpers). Commerce-specific formatting
 * (price/currency) lives in a separate extension in the storefront module.
 *
 * All output is plain text, so NONE of these are flagged safe — Twig's HTML
 * auto-escaping applies. Each helper tolerates null/empty input and returns an
 * empty string instead of throwing.
 */
class FormatExtension extends AbstractExtension
{
    private const DATE_FORMATS = [
        'short' => IntlDateFormatter::SHORT,
        'medium' => IntlDateFormatter::MEDIUM,
        'long' => IntlDateFormatter::LONG,
        'full' => IntlDateFormatter::FULL,
    ];

    /**
     * @param LocaleFormatter $localeFormatter
     * @param TimezoneInterface $timezone
     * @param StripTags $stripTags
     * @param ScopeConfigInterface $scopeConfig
     * @param UrlInterface $url
     * @param StoreManagerInterface $storeManager
     */
    public function __construct(
        private readonly LocaleFormatter $localeFormatter,
        private readonly TimezoneInterface $timezone,
        private readonly StripTags $stripTags,
        private readonly ScopeConfigInterface $scopeConfig,
        private readonly UrlInterface $url,
        private readonly StoreManagerInterface $storeManager
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getFilters(): array
    {
        return [
            new TwigFilter('number', fn(mixed $value): string => $this->formatNumber($value)),
            new TwigFilter(
                'date_format',
                fn(mixed $value, string $format = 'medium', string $part = 'date'): string
                    => $this->formatDate($value, $format, $part)
            ),
            new TwigFilter(
                'strip_tags',
                fn(mixed $value): string => $value === null ? '' : $this->stripTags->filter((string)$value)
            ),
        ];
    }

    /**
     * @inheritDoc
     */
    public function getFunctions(): array
    {
        return [
            new TwigFunction(
                'config',
                fn(string $path, ?string $scope = null): string
                    => (string)$this->scopeConfig->getValue($path, $scope ?? ScopeInterface::SCOPE_STORE)
            ),
            new TwigFunction('url', fn(string $route, array $params = []): string => $this->url->getUrl($route, $params)),
            new TwigFunction('media_url', fn(string $path): string => $this->mediaUrl($path)),
        ];
    }

    private function formatNumber(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return $this->localeFormatter->formatNumber($value + 0);
    }

    /**
     * Normalize the input to the store timezone and format with locale-aware Intl
     * styles. `part` selects which components to show: date | time | datetime.
     */
    private function formatDate(mixed $value, string $format, string $part): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $style = self::DATE_FORMATS[$format] ?? IntlDateFormatter::MEDIUM;
        $date = $this->timezone->date($value);

        return match ($part) {
            'time' => $this->timezone->formatDateTime($date, IntlDateFormatter::NONE, $style),
            'datetime' => $this->timezone->formatDateTime($date, $style, $style),
            default => $this->timezone->formatDateTime($date, $style, IntlDateFormatter::NONE),
        };
    }

    private function mediaUrl(string $path): string
    {
        $base = $this->storeManager->getStore()->getBaseUrl(UrlInterface::URL_TYPE_MEDIA);

        return rtrim($base, '/') . '/' . ltrim($path, '/');
    }
}
