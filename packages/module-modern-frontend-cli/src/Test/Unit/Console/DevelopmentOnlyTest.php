<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Test\Unit\Console;

use MageObsidian\ModernFrontendCli\Console\DevelopmentOnly;
use Magento\Framework\App\State;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Output\BufferedOutput;

final class DevelopmentOnlyTest extends TestCase
{
    private function guard(string $mode): DevelopmentOnly
    {
        $state = $this->createStub(State::class);
        $state->method('getMode')->willReturn($mode);

        return new DevelopmentOnly($state);
    }

    public function testRefusesInProductionAndSaysWhy(): void
    {
        $output = new BufferedOutput();

        $this->assertTrue($this->guard(State::MODE_PRODUCTION)->refuses($output));
        $this->assertStringContainsString('outside production mode', $output->fetch());
    }

    public function testLetsDefaultModeThrough(): void
    {
        $output = new BufferedOutput();

        $this->assertFalse($this->guard(State::MODE_DEFAULT)->refuses($output));
        $this->assertSame('', $output->fetch());
    }

    public function testLetsDeveloperModeThrough(): void
    {
        $this->assertFalse($this->guard(State::MODE_DEVELOPER)->refuses(new BufferedOutput()));
    }
}
