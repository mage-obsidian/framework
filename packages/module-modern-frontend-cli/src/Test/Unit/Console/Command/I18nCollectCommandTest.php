<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Test\Unit\Console\Command;

use Magento\Framework\App\State;
use Magento\Framework\Filesystem\DriverInterface;
use MageObsidian\ModernFrontend\Api\ConfigManagerInterface;
use MageObsidian\ModernFrontend\Service\I18n\CsvDictionary;
use MageObsidian\ModernFrontend\Service\I18n\TwigPhraseExtractor;
use MageObsidian\ModernFrontend\Service\I18n\VuePhraseExtractor;
use MageObsidian\ModernFrontendCli\Console\Command\I18nCollectCommand;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Tester\CommandTester;

class I18nCollectCommandTest extends TestCase
{
    private const MODULE_SRC = '/app/code/Vendor/Storefront/src';
    private const THEME_SRC = '/app/design/frontend/Vendor/theme';

    /** @var array<string, string> */
    private array $files = [];

    protected function setUp(): void
    {
        if (!interface_exists(ConfigManagerInterface::class)) {
            $this->markTestSkipped('the framework package is not installed beside this one');
        }

        $this->files = [
            self::MODULE_SRC . '/view/frontend/templates/cart/summary.twig' =>
                "<p>{{ __('Order total') }}</p><p>{{ __('Order total') }}</p>",
            self::MODULE_SRC . '/view/frontend/templates/cart/empty.twig' =>
                "{# {{ __('Commented') }} #}<p>{{ __('Your cart is empty') }}</p>",
            self::MODULE_SRC . '/view/frontend/web/components/cart/MiniCart.vue' =>
                "<template><span>{{ \$t('Order total') }}</span><b>{{ \$t('Checkout') }}</b></template>",
            self::MODULE_SRC . '/view/frontend/web/generated/bundle.js' => "\$t('Generated, never collected')",
            self::THEME_SRC . '/Magento_Theme/templates/html/header.twig' =>
                "<a>{{ __('Sign In') }}</a><a>{{ __('Search') }}</a>",
        ];
    }

    private function driver(): DriverInterface
    {
        $driver = $this->createStub(DriverInterface::class);
        $driver->method('isExists')->willReturnCallback(
            fn (string $path): bool => isset($this->files[$path])
                || $this->isDirectoryPath($path)
        );
        $driver->method('isDirectory')->willReturnCallback(
            fn (string $path): bool => $this->isDirectoryPath($path)
        );
        $driver->method('readDirectoryRecursively')->willReturnCallback(
            fn (string $path): array => array_values(array_filter(
                array_keys($this->files),
                static fn (string $file): bool => str_starts_with($file, rtrim($path, '/') . '/')
            ))
        );
        $driver->method('fileGetContents')->willReturnCallback(
            fn (string $path): string => $this->files[$path] ?? ''
        );
        $driver->method('filePutContents')->willReturnCallback(
            function (string $path, string $contents): int {
                $this->files[$path] = $contents;
                return strlen($contents);
            }
        );
        $driver->method('createDirectory')->willReturn(true);

        return $driver;
    }

    private function isDirectoryPath(string $path): bool
    {
        $prefix = rtrim($path, '/') . '/';
        foreach (array_keys($this->files) as $file) {
            if (str_starts_with($file, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function collect(string $locale = 'en_US'): CommandTester
    {
        $state = $this->createStub(State::class);
        $configManager = $this->createStub(ConfigManagerInterface::class);
        $configManager->method('get')->willReturn([
            'modules' => ['Vendor_Storefront' => ['src' => self::MODULE_SRC]],
            'themes' => ['Vendor/theme' => ['src' => self::THEME_SRC]],
        ]);

        $command = new I18nCollectCommand(
            $state,
            $configManager,
            new VuePhraseExtractor(),
            new TwigPhraseExtractor(),
            new CsvDictionary(),
            $this->driver()
        );

        $tester = new CommandTester($command);
        $tester->execute(['--locale' => $locale]);

        return $tester;
    }

    public function testEachComponentOwnsItsOwnDictionary(): void
    {
        $this->collect();

        $module = $this->files[self::MODULE_SRC . '/i18n/en_US.csv'] ?? '';
        $theme = $this->files[self::THEME_SRC . '/i18n/en_US.csv'] ?? '';

        $this->assertStringContainsString('"Order total","Order total"', $module);
        $this->assertStringContainsString('"Your cart is empty","Your cart is empty"', $module);
        $this->assertStringContainsString('"Checkout","Checkout"', $module);
        $this->assertStringNotContainsString('Sign In', $module);

        $this->assertStringContainsString('"Sign In","Sign In"', $theme);
        $this->assertStringContainsString('"Search","Search"', $theme);
        $this->assertStringNotContainsString('Order total', $theme);
    }

    public function testACommentedCallNeverReachesADictionary(): void
    {
        $this->collect();

        $this->assertStringNotContainsString('Commented', $this->files[self::MODULE_SRC . '/i18n/en_US.csv']);
    }

    public function testGeneratedOutputIsNotCollected(): void
    {
        $this->collect();

        $this->assertStringNotContainsString(
            'Generated, never collected',
            $this->files[self::MODULE_SRC . '/i18n/en_US.csv']
        );
    }

    public function testAPhraseRepeatedAcrossFilesIsWrittenOnce(): void
    {
        $this->collect();

        $rows = array_filter(
            explode("\n", $this->files[self::MODULE_SRC . '/i18n/en_US.csv']),
            static fn (string $line): bool => str_starts_with($line, '"Order total"')
        );

        $this->assertCount(1, $rows);
    }

    public function testAnExistingTranslationSurvivesAndOnlyMissingPhrasesAreAdded(): void
    {
        $this->files[self::MODULE_SRC . '/i18n/es_ES.csv'] = "\"Order total\",\"Total del pedido\"\n"
            . "\"Gone from the source\",\"Ya no existe\"\n";

        $this->collect('es_ES');

        $csv = $this->files[self::MODULE_SRC . '/i18n/es_ES.csv'];
        $this->assertStringContainsString('"Order total","Total del pedido"', $csv);
        $this->assertStringContainsString('"Gone from the source","Ya no existe"', $csv);
        $this->assertStringContainsString('"Your cart is empty","Your cart is empty"', $csv);
    }

    public function testASecondRunOverTheSameSourcesChangesNothing(): void
    {
        $this->collect();
        $first = $this->files;

        $this->collect();

        $this->assertSame($first, $this->files);
    }

    public function testTheRunReportsWhatItCollected(): void
    {
        $tester = $this->collect();

        $this->assertStringContainsString('modules:Vendor_Storefront', $tester->getDisplay());
        $this->assertStringContainsString('themes:Vendor/theme', $tester->getDisplay());
    }
}
