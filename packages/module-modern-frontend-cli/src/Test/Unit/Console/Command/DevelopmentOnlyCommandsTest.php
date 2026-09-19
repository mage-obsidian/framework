<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Test\Unit\Console\Command;

use MageObsidian\ModernFrontend\Api\ConfigManagerInterface;
use MageObsidian\ModernFrontend\Service\ConfigManager;
use MageObsidian\ModernFrontend\Service\I18n\CsvDictionary;
use MageObsidian\ModernFrontend\Service\I18n\TwigPhraseExtractor;
use MageObsidian\ModernFrontend\Service\I18n\VuePhraseExtractor;
use MageObsidian\ModernFrontendCli\Console\Command\GenerateComponentCommand;
use MageObsidian\ModernFrontendCli\Console\Command\GenerateModuleCommand;
use MageObsidian\ModernFrontendCli\Console\Command\GenerateThemeCommand;
use MageObsidian\ModernFrontendCli\Console\Command\I18nCollectCommand;
use MageObsidian\ModernFrontendCli\Console\DevelopmentOnly;
use MageObsidian\ModernFrontendCli\Service\ScaffoldGenerator;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\State;
use Magento\Framework\Filesystem\DriverInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class DevelopmentOnlyCommandsTest extends TestCase
{
    protected function setUp(): void
    {
        if (!interface_exists(ConfigManagerInterface::class)) {
            $this->markTestSkipped('the framework package is not installed beside this one');
        }
    }

    private function state(string $mode): State
    {
        $state = $this->createStub(State::class);
        $state->method('getMode')->willReturn($mode);

        return $state;
    }

    private function silentGenerator(): ScaffoldGenerator
    {
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->expects($this->never())->method('write');
        $generator->expects($this->never())->method('render');

        return $generator;
    }

    public function testGenerateModuleRefusesInProductionWithoutWriting(): void
    {
        $directoryList = $this->createStub(DirectoryList::class);
        $command = new GenerateModuleCommand(
            $directoryList,
            $this->silentGenerator(),
            new DevelopmentOnly($this->state(State::MODE_PRODUCTION))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::FAILURE, $tester->execute(['name' => 'Acme_Catalog']));
        $this->assertStringContainsString('outside production mode', $tester->getDisplay());
    }

    public function testGenerateThemeRefusesInProductionWithoutWriting(): void
    {
        $command = new GenerateThemeCommand(
            $this->createStub(DirectoryList::class),
            $this->silentGenerator(),
            new DevelopmentOnly($this->state(State::MODE_PRODUCTION))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::FAILURE, $tester->execute(['path' => 'Acme/aurora']));
    }

    public function testGenerateComponentRefusesInProductionWithoutWriting(): void
    {
        $command = new GenerateComponentCommand(
            $this->state(State::MODE_PRODUCTION),
            $this->createStub(ConfigManager::class),
            $this->silentGenerator(),
            new DevelopmentOnly($this->state(State::MODE_PRODUCTION))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::FAILURE, $tester->execute(['name' => 'Button', '--module' => 'Acme_Catalog']));
    }

    public function testI18nCollectRefusesInProductionWithoutWriting(): void
    {
        $driver = $this->createMock(DriverInterface::class);
        $driver->expects($this->never())->method('filePutContents');
        $driver->expects($this->never())->method('createDirectory');
        $state = $this->state(State::MODE_PRODUCTION);
        $command = new I18nCollectCommand(
            $state,
            $this->createStub(ConfigManagerInterface::class),
            $this->createStub(VuePhraseExtractor::class),
            $this->createStub(TwigPhraseExtractor::class),
            $this->createStub(CsvDictionary::class),
            $driver,
            new DevelopmentOnly($state)
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::FAILURE, $tester->execute([]));
    }

    public function testGenerateModuleStillWorksInDefaultMode(): void
    {
        $directoryList = $this->createStub(DirectoryList::class);
        $directoryList->method('getRoot')->willReturn('/magento');
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->method('render')->willReturn('');
        $generator->expects($this->exactly(4))->method('write')->willReturn(true);
        $command = new GenerateModuleCommand(
            $directoryList,
            $generator,
            new DevelopmentOnly($this->state(State::MODE_DEFAULT))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::SUCCESS, $tester->execute(['name' => 'Acme_Catalog']));
    }

    public function testGenerateModuleStillWorksInDeveloperMode(): void
    {
        $directoryList = $this->createStub(DirectoryList::class);
        $directoryList->method('getRoot')->willReturn('/magento');
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->method('render')->willReturn('');
        $generator->expects($this->exactly(4))->method('write')->willReturn(true);
        $command = new GenerateModuleCommand(
            $directoryList,
            $generator,
            new DevelopmentOnly($this->state(State::MODE_DEVELOPER))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::SUCCESS, $tester->execute(['name' => 'Acme_Catalog']));
    }

    public function testGenerateThemeStillWorksInDefaultMode(): void
    {
        $directoryList = $this->createStub(DirectoryList::class);
        $directoryList->method('getRoot')->willReturn('/magento');
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->method('render')->willReturn('');
        $generator->expects($this->exactly(6))->method('write')->willReturn(true);
        $command = new GenerateThemeCommand(
            $directoryList,
            $generator,
            new DevelopmentOnly($this->state(State::MODE_DEFAULT))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::SUCCESS, $tester->execute(['path' => 'Acme/aurora']));
    }

    public function testGenerateThemeStillWorksInDeveloperMode(): void
    {
        $directoryList = $this->createStub(DirectoryList::class);
        $directoryList->method('getRoot')->willReturn('/magento');
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->method('render')->willReturn('');
        $generator->expects($this->exactly(6))->method('write')->willReturn(true);
        $command = new GenerateThemeCommand(
            $directoryList,
            $generator,
            new DevelopmentOnly($this->state(State::MODE_DEVELOPER))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::SUCCESS, $tester->execute(['path' => 'Acme/aurora']));
    }

    private function configManagerForComponent(): ConfigManager
    {
        $configManager = $this->createStub(ConfigManager::class);
        $configManager->method('isModuleEnabled')->willReturn(true);
        $configManager->method('get')->willReturn([
            'modules' => ['Acme_Catalog' => ['src' => '/magento/app/code/Acme/Catalog']],
            'themes' => [],
        ]);

        return $configManager;
    }

    public function testGenerateComponentStillWorksInDefaultMode(): void
    {
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->method('render')->willReturn('');
        $generator->expects($this->once())->method('write')->willReturn(true);
        $command = new GenerateComponentCommand(
            $this->state(State::MODE_DEFAULT),
            $this->configManagerForComponent(),
            $generator,
            new DevelopmentOnly($this->state(State::MODE_DEFAULT))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::SUCCESS, $tester->execute(['name' => 'Button', '--module' => 'Acme_Catalog']));
    }

    public function testGenerateComponentStillWorksInDeveloperMode(): void
    {
        $generator = $this->createMock(ScaffoldGenerator::class);
        $generator->method('render')->willReturn('');
        $generator->expects($this->once())->method('write')->willReturn(true);
        $command = new GenerateComponentCommand(
            $this->state(State::MODE_DEVELOPER),
            $this->configManagerForComponent(),
            $generator,
            new DevelopmentOnly($this->state(State::MODE_DEVELOPER))
        );
        $tester = new CommandTester($command);

        $this->assertSame(Command::SUCCESS, $tester->execute(['name' => 'Button', '--module' => 'Acme_Catalog']));
    }

    private function i18nCommand(State $state): I18nCollectCommand
    {
        $configManager = $this->createStub(ConfigManagerInterface::class);
        $configManager->method('get')->willReturn(['modules' => [], 'themes' => []]);

        return new I18nCollectCommand(
            $state,
            $configManager,
            $this->createStub(VuePhraseExtractor::class),
            $this->createStub(TwigPhraseExtractor::class),
            $this->createStub(CsvDictionary::class),
            $this->createStub(DriverInterface::class),
            new DevelopmentOnly($state)
        );
    }

    public function testI18nCollectStillWorksInDefaultMode(): void
    {
        $tester = new CommandTester($this->i18nCommand($this->state(State::MODE_DEFAULT)));

        $this->assertSame(Command::SUCCESS, $tester->execute([]));
        $this->assertStringNotContainsString('outside production mode', $tester->getDisplay());
    }

    public function testI18nCollectStillWorksInDeveloperMode(): void
    {
        $tester = new CommandTester($this->i18nCommand($this->state(State::MODE_DEVELOPER)));

        $this->assertSame(Command::SUCCESS, $tester->execute([]));
        $this->assertStringNotContainsString('outside production mode', $tester->getDisplay());
    }
}
