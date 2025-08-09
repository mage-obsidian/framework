<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console\Command;

use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Filesystem\DriverInterface;
use MageObsidian\ModernFrontend\Model\Config\ConfigProvider;
use MageObsidian\ModernFrontend\Service\Dev\ViteEnvFile;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Drives the MageObsidian dev workflow from Magento. Today it derives the Vite
 * harness `.env` from Magento config (the single source of truth) so the dev
 * server, vite.config.js and buildThemes.js all read one set of values that an
 * operator edits once under Stores > Configuration > MageObsidian.
 *
 * Process orchestration (--start/--stop/--status) is intentionally not handled
 * here: the dev server runs in a separate container from where bin/magento
 * executes, so cross-container lifecycle control belongs to the host tooling.
 */
class FrontendDevCommand extends Command
{
    private const OPTION_SYNC_ENV = 'sync-env';
    private const OPTION_SHOW = 'show';
    private const VITE_ENV_RELATIVE_PATH = 'vite/.env';

    public function __construct(
        private readonly ConfigProvider $configProvider,
        private readonly DirectoryList $directoryList,
        private readonly DriverInterface $fileDriver
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:dev')
            ->setDescription('Manage the MageObsidian dev workflow (derive the Vite .env from Magento config).')
            ->addOption(
                self::OPTION_SYNC_ENV,
                null,
                InputOption::VALUE_NONE,
                'Write the Vite harness .env (vite/.env) from the current Magento config.'
            )
            ->addOption(
                self::OPTION_SHOW,
                null,
                InputOption::VALUE_NONE,
                'Print the env vars derived from Magento config without writing any file.'
            );

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);

        $vars = $this->configProvider->getViteEnvVars();

        if ($input->getOption(self::OPTION_SHOW)) {
            $this->renderVars($io, $vars);
            return Command::SUCCESS;
        }

        if ($input->getOption(self::OPTION_SYNC_ENV)) {
            return $this->syncEnv($io, $vars);
        }

        $io->warning('Nothing to do. Use --sync-env to write vite/.env or --show to preview the derived values.');
        return Command::SUCCESS;
    }

    /**
     * @param array<string, string> $vars
     */
    private function syncEnv(CustomSymfonyStyle $io, array $vars): int
    {
        $io->title('MageObsidian Frontend Dev — sync .env');

        $envPath = $this->directoryList->getRoot() . '/' . self::VITE_ENV_RELATIVE_PATH;
        $body = ViteEnvFile::render($vars);

        try {
            $tmpPath = $envPath . '.tmp';
            $this->fileDriver->filePutContents($tmpPath, $body);
            $this->fileDriver->rename($tmpPath, $envPath);
        } catch (FileSystemException $e) {
            $io->error(sprintf('Could not write %s: %s', $envPath, $e->getMessage()));
            return Command::FAILURE;
        }

        $this->renderVars($io, $vars);
        $io->success(sprintf('Wrote %s', $envPath));
        return Command::SUCCESS;
    }

    /**
     * @param array<string, string> $vars
     */
    private function renderVars(CustomSymfonyStyle $io, array $vars): void
    {
        $rows = [];
        foreach ($vars as $key => $value) {
            $rows[] = [$key, $value];
        }
        $io->table(['Env var', 'Value'], $rows);
    }
}
