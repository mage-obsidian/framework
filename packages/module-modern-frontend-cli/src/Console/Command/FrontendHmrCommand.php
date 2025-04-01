<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendCli\Console\Command;

use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\Config\Storage\WriterInterface;
use Magento\Store\Model\ScopeInterface;
use MageObsidian\ModernFrontend\Model\Config\ConfigProvider;
use MageObsidian\ModernFrontend\Service\ConfigManager;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\App\State;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;

class FrontendHmrCommand extends Command
{
    /**
     * FrontendHmrCommand constructor.
     *
     * @param State $state
     * @param ScopeConfigInterface $scopeConfig
     * @param WriterInterface $configWriter
     */
    public function __construct(
        private readonly State $state,
        private readonly ScopeConfigInterface $scopeConfig,
        private readonly WriterInterface $configWriter
    ) {
        parent::__construct();
    }

    /**
     * Configures the command.
     *
     * @return void
     */
    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:hmr')
             ->setDescription('Manage Hot Module Replacement (HMR) configuration for modules and themes compatible with the modern frontend.')
             ->addOption(
                 'show',
                 null,
                 InputOption::VALUE_NONE,
                 'Show the current status of Hot Module Replacement (HMR).'
             )
             ->addOption('enable', null, InputOption::VALUE_NONE, 'Enable Hot Module Replacement (HMR).')
             ->addOption('disable', null, InputOption::VALUE_NONE, 'Disable Hot Module Replacement (HMR).');

        parent::configure();
    }

    /**
     * Executes the command.
     *
     * @param InputInterface $input
     * @param OutputInterface $output
     *
     * @return int
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);
        $showOption = $input->getOption('show');
        $enableOption = $input->getOption('enable');
        $disableOption = $input->getOption('disable');

        try {
            $this->state->setAreaCode('global');

            if ($showOption) {
                $this->showConfig($io);
            } elseif ($enableOption) {
                $this->setHmrOption(true);
                $io->success('Hot Module Replacement (HMR) has been enabled. If configuration cache is active, please clear it to apply the changes.');
            } elseif ($disableOption) {
                $this->setHmrOption(false);
                $io->success('Hot Module Replacement (HMR) has been disabled. If configuration cache is active, please clear it to apply the changes.');
            } else {
                $io->error('Please specify an option: --show, --enable, or --disable.');
                return Command::FAILURE;
            }
        } catch (FileSystemException|LocalizedException $e) {
            $io->error('An error occurred: ' . $e->getMessage());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    /**
     * Show the current status of Hot Module Replacement (HMR).
     *
     * @param CustomSymfonyStyle $io
     */
    private function showConfig(CustomSymfonyStyle $io): void
    {
        $status = (bool)$this->scopeConfig->getValue(ConfigProvider::HMR_ENABLED);
        $statusText = $status ? 'enabled' : 'disabled';
        $io->info('Hot Module Replacement (HMR) is currently ' . $statusText . '.');
        if ($status && $this->state->getMode() === State::MODE_PRODUCTION) {
            $io->warning('Hot Module Replacement (HMR) is enabled but will be ignored because the system is in production mode.');
        }
    }

    /**
     * Set the Hot Module Replacement (HMR) option.
     *
     * @param bool $state
     */
    private function setHmrOption(bool $state): void
    {
        $this->configWriter->save(ConfigProvider::HMR_ENABLED, $state);
    }
}
