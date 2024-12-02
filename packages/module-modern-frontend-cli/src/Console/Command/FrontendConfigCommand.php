<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendCli\Console\Command;

use MageObsidian\ModernFrontend\Service\ConfigManager;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\App\State;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;

class FrontendConfigCommand extends Command
{
    public function __construct(
        private readonly State $state,
        private readonly ConfigManager $configManager
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:config')
             ->setDescription('Manage configuration of active modules and themes compatible with the modern frontend.')
             ->addOption(
                 'generate',
                 null,
                 InputOption::VALUE_NONE,
                 'Generate or update the configuration file for active compatible modules and themes.'
             )
             ->addOption(
                 'show',
                 null,
                 InputOption::VALUE_NONE,
                 'Display the current configuration of compatible modules and themes.'
             )
             ->addOption(
                 'modules',
                 null,
                 InputOption::VALUE_NONE,
                 'Display only the modules configuration.'
             )
             ->addOption(
                 'themes',
                 null,
                 InputOption::VALUE_NONE,
                 'Display only the themes configuration.'
             );

        parent::configure();
    }

    /**
     * Executes the command.
     *
     * @throws FileSystemException
     * @throws LocalizedException
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle(
            $input,
            $output
        );
        $generateOption = $input->getOption('generate');
        $showOption = $input->getOption('show');
        $modulesOption = $input->getOption('modules');
        $themesOption = $input->getOption('themes');

        try {
            $this->state->setAreaCode('global');

            if ($showOption) {
                if (!$this->configManager->hasConfig()) {
                    $io->note('Configuration file not found. Generating it now...');
                    $this->generateConfig($io);
                }
                $this->showConfig(
                    $io,
                    $modulesOption,
                    $themesOption
                );
            } elseif ($generateOption) {
                $this->generateConfig($io);
            } else {
                $this->showUsage($io);
            }
        } catch (FileSystemException|LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    /**
     * Generates the configuration.
     *
     * @throws FileSystemException
     * @throws LocalizedException
     */
    private function generateConfig(CustomSymfonyStyle $io): void
    {
        $this->configManager->generate();
        $io->info('Configuration file has been generated successfully.');

        // Display details in a table
        $configPaths = $this->configManager->getConfigFilePath();
        $tableRows = array_map(fn($filePath) => [$filePath],
            $configPaths);

        $io->table(
            ['Files Generated'],
            $tableRows
        );
    }

    /**
     * Displays the configuration based on options.
     *
     * @throws LocalizedException
     * @throws FileSystemException
     */
    private function showConfig(CustomSymfonyStyle $io, bool $modulesOption, bool $themesOption): void
    {
        $configData = $this->configManager->get();
        $io->info('Current Configuration');

        if (!$modulesOption && !$themesOption) {
            $modulesOption = $themesOption = true; // Show both if no specific option provided
        }

        if ($modulesOption) {
            $this->showModulesConfig(
                $io,
                $configData
            );
        }

        if ($themesOption) {
            $this->showThemesConfig(
                $io,
                $configData
            );
        }
    }

    /**
     * Displays only the modules configuration.
     *
     * @param CustomSymfonyStyle $io
     * @param array $configData
     */
    private function showModulesConfig(CustomSymfonyStyle $io, array $configData): void
    {
        $io->note('Modules Configuration');
        if (empty($configData['modules'])) {
            $io->warning('No modules configuration found.');
        } else {
            $tableRows = [];
            foreach ($configData['modules'] as $module => $config) {
                $tableRows[] = [
                    'Module' => $module,
                    'Path' => $config['src']
                ];
            }

            $io->table(
                ['Module', 'Path'],
                $tableRows
            );
        }
    }

    /**
     * Displays only the themes configuration.
     *
     * @param CustomSymfonyStyle $io
     * @param array $configData
     */
    private function showThemesConfig(CustomSymfonyStyle $io, array $configData): void
    {
        $io->note('Themes Configuration');

        if (empty($configData['themes'])) {
            $io->warning('No themes configuration found.');
        } else {
            $tableRows = [];
            foreach ($configData['themes'] as $theme => $config) {
                $tableRows[] = [
                    'Module' => $theme,
                    'Path' => $config['src']
                ];
            }

            $io->table(
                ['Theme', 'Path'],
                $tableRows
            );
        }
    }

    /**
     * Displays the usage message when no options are specified.
     *
     * @param CustomSymfonyStyle $io
     *
     * @return void
     */
    private function showUsage(CustomSymfonyStyle $io): void
    {
        $io->error('No option specified. Use one of the following:');
        $io->listing([
                         '--generate   Generate or update the configuration file.',
                         '--show       Display the current configuration of compatible modules and themes.',
                         '--modules    Display only the modules configuration.',
                         '--themes     Display only the themes configuration.',
                     ]);
    }
}
