<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console\Command;

use Magento\Deploy\Model\ModeFactory;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\State;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Filesystem\DriverInterface;
use MageObsidian\ModernFrontend\Api\ConfigManagerInterface;
use MageObsidian\ModernFrontend\Model\Config\ConfigProvider;
use MageObsidian\ModernFrontend\Service\Dev\DevServerProcess;
use MageObsidian\ModernFrontend\Service\Dev\DevWorkflow;
use MageObsidian\ModernFrontend\Service\Dev\HttpProberInterface;
use MageObsidian\ModernFrontend\Service\Dev\NginxSnippet;
use MageObsidian\ModernFrontend\Service\Dev\ThemeSelector;
use MageObsidian\ModernFrontend\Service\Dev\ViteEnvFile;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\ChoiceQuestion;

/**
 * Drives the MageObsidian dev workflow from Magento. The headline is the
 * deterministic one-shot pair --up / --down so an operator never has to chain
 * deploy mode + HMR flag + cache flush + dev server by hand:
 *  - --up:   developer mode + HMR on + sync vite/.env + flush + (probe-first) dev server;
 *  - --down: dev server off + HMR off + flush + rebuild assets to disk (--production for the full switch).
 * The granular flags (--start/--stop/--status/--sync-env/--print-nginx) remain for scripting.
 *
 * Environment-agnostic by design: it launches the dev server *here*, where the
 * command runs, and never reasons about containers. But it is probe-first — if a
 * dev server already answers (e.g. one the environment manages), it is left
 * alone instead of spawning a second, unreachable one.
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
    private const OPTION_UP = 'up';
    private const OPTION_DOWN = 'down';
    private const OPTION_NO_START = 'no-start';
    private const OPTION_PRODUCTION = 'production';
    private const VITE_ENV_RELATIVE_PATH = 'vite/.env';
    private const ALL_THEMES = 'all';

    public function __construct(
        private readonly ConfigProvider $configProvider,
        private readonly DirectoryList $directoryList,
        private readonly DriverInterface $fileDriver,
        private readonly DevServerProcess $devServerProcess,
        private readonly HttpProberInterface $prober,
        private readonly DevWorkflow $devWorkflow,
        private readonly ConfigManagerInterface $configManager,
        private readonly State $appState,
        private readonly ModeFactory $modeFactory
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:dev')
            ->setDescription('Manage the MageObsidian dev workflow (one-shot --up/--down, Vite .env, dev server).')
            ->addOption(
                self::OPTION_UP,
                null,
                InputOption::VALUE_NONE,
                'One shot: developer mode + HMR on + sync .env + flush + start the dev server (probe-first).'
            )
            ->addOption(
                self::OPTION_DOWN,
                null,
                InputOption::VALUE_NONE,
                'One shot: stop the dev server + HMR off + flush + rebuild assets to disk.'
            )
            ->addOption(
                self::OPTION_NO_START,
                null,
                InputOption::VALUE_NONE,
                'With --up: set state only, do not start the dev server (the environment runs it).'
            )
            ->addOption(
                self::OPTION_PRODUCTION,
                null,
                InputOption::VALUE_NONE,
                'With --down: also switch Magento to production mode (di:compile + static deploy).'
            )
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
                'Start the local Vite dev server. Picks a theme interactively if --theme is omitted.'
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
                'Theme to serve/build (e.g. Vendor/theme). Prompted when omitted on a terminal.'
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

        if ($input->getOption(self::OPTION_UP)) {
            return $this->up($io, $input, $output);
        }
        if ($input->getOption(self::OPTION_DOWN)) {
            return $this->down($io, $input, $output);
        }
        if ($input->getOption(self::OPTION_START)) {
            $theme = $this->resolveTheme($input, $output, (string)$input->getOption(self::OPTION_THEME));
            if ($theme === null) {
                $io->error('A theme is required. Pass --theme=<Vendor/theme> or run on a terminal to pick one.');
                return Command::FAILURE;
            }
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
            'Nothing to do. Use --up / --down, or --start --theme=<t>, --stop, --status, --sync-env, --print-nginx.'
        );
        return Command::SUCCESS;
    }

    /**
     * One-shot "into dev": developer mode + HMR on + .env synced + caches flushed
     * + a dev server reachable (probe-first, so an environment-managed one is not
     * duplicated). Idempotent: safe to re-run.
     */
    private function up(CustomSymfonyStyle $io, InputInterface $input, OutputInterface $output): int
    {
        $io->title('MageObsidian Frontend Dev — up');

        $theme = $this->resolveTheme($input, $output, (string)$input->getOption(self::OPTION_THEME));
        if ($theme === null) {
            $io->error('A theme is required. Pass --theme=<Vendor/theme> or run on a terminal to pick one.');
            return Command::FAILURE;
        }

        if ($this->appState->getMode() !== State::MODE_DEVELOPER) {
            $this->modeFactory->create(['input' => $input, 'output' => $output])->enableDeveloperMode();
            $io->writeln('<info>Switched to developer mode.</info>');
        }

        $this->devWorkflow->setHmr(true);
        $io->writeln('<info>HMR enabled.</info>');

        $syncExit = $this->syncEnv($io, $this->configProvider->getViteEnvVars());
        if ($syncExit !== Command::SUCCESS) {
            return $syncExit;
        }

        try {
            $result = $this->devWorkflow->ensureDevServerRunning($theme, (bool)$input->getOption(self::OPTION_NO_START));
        } catch (LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        match ($result['action']) {
            'already-running' => $io->success('Dev server already running — left it alone. HMR is live.'),
            'skipped' => $io->success(sprintf(
                'State set for "%s". Start the dev server in your environment (HMR is live once it answers).',
                $theme
            )),
            default => $io->success(sprintf(
                'Up. Dev server started (pid %d, theme "%s"). Logs: %s',
                $result['info']['pid'],
                $result['info']['theme'],
                $result['info']['log']
            )),
        };

        $io->writeln('  Diagnose anytime: bin/magento mage-obsidian:frontend:doctor');
        return Command::SUCCESS;
    }

    /**
     * One-shot "back to built assets": stop the dev server, HMR off, flush, and
     * rebuild the theme to disk. With --production, also switch Magento to
     * production mode (the heavy di:compile + static deploy).
     */
    private function down(CustomSymfonyStyle $io, InputInterface $input, OutputInterface $output): int
    {
        $io->title('MageObsidian Frontend Dev — down');

        // Capture the served theme before stop() clears the tracked state.
        $tracked = $this->devServerProcess->status()['theme'] ?? null;

        try {
            $pid = $this->devWorkflow->stopDevServer();
        } catch (LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }
        $io->writeln($pid !== null
            ? sprintf('<info>Dev server stopped (pid %d).</info>', $pid)
            : '<info>No tracked dev server was running.</info>');

        $this->devWorkflow->setHmr(false);
        $io->writeln('<info>HMR disabled.</info>');

        $theme = (string)$input->getOption(self::OPTION_THEME);
        if ($theme === '') {
            $theme = $tracked ?? self::ALL_THEMES;
        }
        $buildExit = $this->buildOnce($io, $theme);
        if ($buildExit !== Command::SUCCESS) {
            return $buildExit;
        }

        if ($input->getOption(self::OPTION_PRODUCTION)) {
            $io->writeln('<info>Switching to production mode…</info>');
            $this->modeFactory->create(['input' => $input, 'output' => $output])->enableProductionMode();
        }

        $io->success('Down. Serving built assets.');
        return Command::SUCCESS;
    }

    /**
     * Resolve the theme to act on: an explicit --theme wins; otherwise prompt to
     * pick one from the enabled MageObsidian themes when on a terminal.
     */
    private function resolveTheme(InputInterface $input, OutputInterface $output, string $optionTheme): ?string
    {
        return ThemeSelector::resolve(
            $optionTheme,
            $this->availableThemes(),
            $input->isInteractive(),
            function (array $themes) use ($input, $output): ?string {
                $question = new ChoiceQuestion('Select a theme to serve', $themes);
                $question->setErrorMessage('Theme "%s" is not one of the available themes.');
                /** @var string|null $answer */
                $answer = $this->getHelper('question')->ask($input, $output, $question);
                return $answer;
            }
        );
    }

    /**
     * Theme codes declared in the generated frontend contract (the same list the
     * JS harness builds from).
     *
     * @return string[]
     */
    private function availableThemes(): array
    {
        if (!$this->configManager->hasConfig()) {
            return [];
        }
        $themes = $this->configManager->get()['themes'] ?? [];

        return is_array($themes) ? array_keys($themes) : [];
    }

    private function start(CustomSymfonyStyle $io, string $theme): int
    {
        $io->title('MageObsidian Frontend Dev — start');

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
     * --start --no-watch / --down: build the theme once to disk (no HMR, no daemon).
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
