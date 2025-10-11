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
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Filesystem\DriverInterface;
use MageObsidian\ModernFrontend\Model\Config\ConfigProvider;
use MageObsidian\ModernFrontend\Service\Dev\DevServerProcess;
use MageObsidian\ModernFrontend\Service\Dev\HttpProberInterface;
use MageObsidian\ModernFrontend\Service\Dev\NginxSnippet;
use MageObsidian\ModernFrontend\Service\Dev\ViteEnvFile;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Drives the MageObsidian dev workflow from Magento:
 *  - derives the Vite harness `.env` from Magento config (the single source of
 *    truth) so the dev server, vite.config.js and buildThemes.js read one set of
 *    values an operator edits once under Stores > Configuration > MageObsidian;
 *  - starts/stops/reports the local Vite dev server process.
 *
 * Environment-agnostic by design: --start launches the dev server *here*, where
 * the command runs, and never reasons about containers or how the project is
 * mounted. Running the dev server in a different container than bin/magento is
 * the environment's concern (e.g. a wrapper that execs into the right place).
 */
class FrontendDevCommand extends Command
{
    private const OPTION_SYNC_ENV = 'sync-env';
    private const OPTION_SHOW = 'show';
    private const OPTION_START = 'start';
    private const OPTION_STOP = 'stop';
    private const OPTION_STATUS = 'status';
    private const OPTION_PRINT_NGINX = 'print-nginx';
    private const OPTION_THEME = 'theme';
    private const OPTION_WATCH = 'watch';
    private const OPTION_NO_WATCH = 'no-watch';
    private const VITE_ENV_RELATIVE_PATH = 'vite/.env';

    public function __construct(
        private readonly ConfigProvider $configProvider,
        private readonly DirectoryList $directoryList,
        private readonly DriverInterface $fileDriver,
        private readonly DevServerProcess $devServerProcess,
        private readonly HttpProberInterface $prober
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:dev')
            ->setDescription('Manage the MageObsidian dev workflow (Vite .env and the local dev server).')
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
            )
            ->addOption(
                self::OPTION_START,
                null,
                InputOption::VALUE_NONE,
                'Start the local Vite dev server (requires --theme). Syncs .env first.'
            )
            ->addOption(
                self::OPTION_STOP,
                null,
                InputOption::VALUE_NONE,
                'Stop the local Vite dev server started by --start.'
            )
            ->addOption(
                self::OPTION_STATUS,
                null,
                InputOption::VALUE_NONE,
                'Report whether the local dev server process is running and reachable.'
            )
            ->addOption(
                self::OPTION_PRINT_NGINX,
                null,
                InputOption::VALUE_NONE,
                'Print the nginx proxy snippet (derived from config) to paste into your server block.'
            )
            ->addOption(
                self::OPTION_THEME,
                null,
                InputOption::VALUE_REQUIRED,
                'Theme to serve when starting the dev server (e.g. Vendor/theme).'
            )
            ->addOption(
                self::OPTION_WATCH,
                null,
                InputOption::VALUE_NONE,
                'With --start: run the HMR dev server (default).'
            )
            ->addOption(
                self::OPTION_NO_WATCH,
                null,
                InputOption::VALUE_NONE,
                'With --start: build the theme once to disk instead of running the dev server.'
            );

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);

        if ($input->getOption(self::OPTION_START)) {
            $theme = (string)$input->getOption(self::OPTION_THEME);
            return $input->getOption(self::OPTION_NO_WATCH)
                ? $this->buildOnce($io, $theme)
                : $this->start($io, $theme);
        }
        if ($input->getOption(self::OPTION_STOP)) {
            return $this->stop($io);
        }
        if ($input->getOption(self::OPTION_STATUS)) {
            return $this->showStatus($io);
        }
        if ($input->getOption(self::OPTION_PRINT_NGINX)) {
            $vars = $this->configProvider->getViteEnvVars();
            $output->writeln(NginxSnippet::render(
                $vars[ViteEnvFile::VAR_SERVER_HOST] ?? '',
                $vars[ViteEnvFile::VAR_SERVER_PORT] ?? ''
            ));
            return Command::SUCCESS;
        }
        if ($input->getOption(self::OPTION_SHOW)) {
            $this->renderVars($io, $this->configProvider->getViteEnvVars());
            return Command::SUCCESS;
        }
        if ($input->getOption(self::OPTION_SYNC_ENV)) {
            return $this->syncEnv($io, $this->configProvider->getViteEnvVars());
        }

        $io->warning(
            'Nothing to do. Use --sync-env, --show, --start --theme=<t>, --stop, --status or --print-nginx.'
        );
        return Command::SUCCESS;
    }

    private function start(CustomSymfonyStyle $io, string $theme): int
    {
        $io->title('MageObsidian Frontend Dev — start');

        if ($theme === '') {
            $io->error('A theme is required to start the dev server. Pass --theme=<Vendor/theme>.');
            return Command::FAILURE;
        }

        $syncExit = $this->syncEnv($io, $this->configProvider->getViteEnvVars());
        if ($syncExit !== Command::SUCCESS) {
            return $syncExit;
        }

        try {
            $info = $this->devServerProcess->start($theme);
        } catch (LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        $io->success(sprintf('Dev server started (pid %d, theme "%s").', $info['pid'], $info['theme']));
        $io->writeln(sprintf('  Logs: %s', $info['log']));
        $io->writeln('  Check it with: bin/magento mage-obsidian:frontend:dev --status');
        return Command::SUCCESS;
    }

    /**
     * --start --no-watch: build the theme once to disk (no HMR, no daemon).
     */
    private function buildOnce(CustomSymfonyStyle $io, string $theme): int
    {
        $io->title('MageObsidian Frontend Dev — build (no watch)');

        if ($theme === '') {
            $io->error('A theme is required to build. Pass --theme=<Vendor/theme>.');
            return Command::FAILURE;
        }

        try {
            $exitCode = $this->devServerProcess->build($theme, function (string $type, string $buffer) use ($io): void {
                $io->write($buffer);
            });
        } catch (LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        if ($exitCode !== 0) {
            $io->error(sprintf('Build failed for theme "%s" (exit %d).', $theme, $exitCode));
            return Command::FAILURE;
        }

        $io->success(sprintf('Built theme "%s" to disk.', $theme));
        return Command::SUCCESS;
    }

    private function stop(CustomSymfonyStyle $io): int
    {
        try {
            $pid = $this->devServerProcess->stop();
        } catch (LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        if ($pid === null) {
            $io->warning('No dev server was running (cleared any stale state).');
            return Command::SUCCESS;
        }

        $io->success(sprintf('Dev server stopped (pid %d).', $pid));
        return Command::SUCCESS;
    }

    private function showStatus(CustomSymfonyStyle $io): int
    {
        $status = $this->devServerProcess->status();
        $rows = [];

        if ($status['running']) {
            $rows[] = ['<fg=green>● running</>', sprintf('pid %d, theme "%s"', $status['pid'], $status['theme'] ?? 'unknown')];
        } else {
            $rows[] = ['<fg=yellow>○ stopped</>', 'No tracked dev server process.'];
        }

        $probe = $this->probeDevServer();
        if ($probe !== null) {
            $rows[] = $probe['reachable']
                ? ['<fg=green>● reachable</>', $probe['url']]
                : ['<fg=red>● unreachable</>', $probe['url'] . ' — ' . $probe['detail']];
        }

        $io->table(['Dev server', 'Detail'], $rows);
        return Command::SUCCESS;
    }

    /**
     * Probe the dev server over the network at its configured host:port. This is
     * the same reachability signal the doctor and the client-side guard use.
     *
     * @return array{reachable:bool, url:string, detail:string}|null
     */
    private function probeDevServer(): ?array
    {
        $vars = $this->configProvider->getViteEnvVars();
        $host = $vars[ViteEnvFile::VAR_SERVER_HOST] ?? '';
        $port = $vars[ViteEnvFile::VAR_SERVER_PORT] ?? '';
        if ($host === '' || $port === '') {
            return null;
        }

        $url = sprintf('http://%s:%s/@vite/client', $host, $port);
        $result = $this->prober->probe($url);

        return [
            'reachable' => $result->isJavaScript(),
            'url' => $url,
            'detail' => $result->describeFailure(),
        ];
    }

    /**
     * @param array<string, string> $vars
     */
    private function syncEnv(CustomSymfonyStyle $io, array $vars): int
    {
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
        $io->writeln(sprintf('<info>Wrote %s</info>', $envPath));
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
