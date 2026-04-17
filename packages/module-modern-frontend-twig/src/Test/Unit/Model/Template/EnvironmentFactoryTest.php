<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\State;
use MageObsidian\ModernFrontendTwig\Model\Template\EnvironmentFactory;
use MageObsidian\ModernFrontendTwig\Model\Template\FilesystemLoader;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

/**
 * Locks in the DI-driven extensibility of the Twig environment: extensions are
 * injected as an array (mergeable across modules), the factory rejects items
 * that are not real Twig extensions with an actionable error, and the built
 * environment stays memoized (one instance per request). Needs the Twig library
 * + Magento types, so it runs in a real Magento root (see phpunit.ci.xml).
 */
class EnvironmentFactoryTest extends TestCase
{
    protected function setUp(): void
    {
        if (!class_exists(Environment::class)) {
            $this->markTestSkipped('Twig is not installed in this runtime.');
        }
    }

    private function factory(array $extensions): EnvironmentFactory
    {
        $loader = $this->createMock(FilesystemLoader::class);
        $directoryList = $this->createMock(DirectoryList::class);
        $directoryList->method('getPath')->willReturn(sys_get_temp_dir());
        $state = $this->createMock(State::class);
        $state->method('getMode')->willReturn(State::MODE_PRODUCTION);

        return new EnvironmentFactory($loader, $directoryList, $state, $extensions);
    }

    private function markerExtension(): AbstractExtension
    {
        return new class extends AbstractExtension {
            public function getFilters(): array
            {
                return [new TwigFilter('marker', static fn($value): string => (string)$value)];
            }
        };
    }

    public function testRegistersInjectedExtensions(): void
    {
        $environment = $this->factory([$this->markerExtension()])->create();

        $this->assertNotNull($environment->getFilter('marker'));
    }

    public function testRejectsItemsThatAreNotTwigExtensions(): void
    {
        $this->expectException(\UnexpectedValueException::class);

        $this->factory([new \stdClass()])->create();
    }

    public function testMemoizesTheEnvironment(): void
    {
        $factory = $this->factory([$this->markerExtension()]);

        $this->assertSame($factory->create(), $factory->create());
    }
}
