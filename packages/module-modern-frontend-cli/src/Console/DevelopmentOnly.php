<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console;

use Magento\Framework\App\State;
use Symfony\Component\Console\Output\OutputInterface;

final class DevelopmentOnly
{
    public function __construct(private readonly State $state)
    {
    }

    public function refuses(OutputInterface $output): bool
    {
        if ($this->state->getMode() !== State::MODE_PRODUCTION) {
            return false;
        }

        $output->writeln(
            '<error>This command writes source files and only runs outside production mode. '
            . 'Run it in a development environment and deploy the result.</error>'
        );

        return true;
    }
}
