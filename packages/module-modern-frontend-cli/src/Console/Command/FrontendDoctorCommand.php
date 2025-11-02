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
use Magento\Framework\App\State;
use Magento\Framework\Filesystem\DriverInterface;
use MageObsidian\ModernFrontend\Api\Data\ConfigInterface;
use MageObsidian\ModernFrontend\Api\ConfigManagerInterface;
use MageObsidian\ModernFrontend\Model\Config\ConfigProvider;
use MageObsidian\ModernFrontend\Service\Dev\CheckResult;
use MageObsidian\ModernFrontend\Service\Dev\DevDiagnostics;
use MageObsidian\ModernFrontend\Service\Dev\HttpProberInterface;
use MageObsidian\ModernFrontend\Service\Dev\ProbeResult;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Diagnoses the MageObsidian dev environment: app mode, contract, HMR flag,
 * Vite dev server reachability and required env vars. Each check is reported as
 * ok/warn/error with an actionable hint.
 *
 * The dev server is probed at its configured host:port (vite/.env), which is the
 * address reachable from where bin/magento runs. Full storefront→Vite chain
 * validation (public URLs, nginx proxy) is the client-side guard's job, since
 * those URLs resolve from the browser, not necessarily from the CLI host.
 */
class FrontendDoctorCommand extends Command
{
    private const REQUIRED_ENV_VARS = [
        'VITE_SERVER_HOST',
        'VITE_SERVER_PORT',
        'VITE_SERVER_SECURE',
        'VITE_HMR_PATH',
        'MAGENTO_HOST',
        'VITE_SERVER_ALLOWED_HOSTS',
    ];

    public function __construct(
        private readonly State $state,
        private readonly ConfigProvider $configProvider,
        private readonly ConfigManagerInterface $configManager,
        private readonly HttpProberInterface $prober,
        private readonly DevDiagnostics $diagnostics,
        private readonly DirectoryList $directoryList,
        private readonly DriverInterface $fileDriver
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:doctor')
            ->setDescription('Diagnose the MageObsidian dev environment (HMR, Vite dev server, contract, config).');

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);
        $io->title('MageObsidian Frontend Doctor');

        $mode = $this->state->getMode();
        $hmrEnabled = $this->configProvider->isHmrEnabled();
        $env = $this->parseEnv();

        $contractExists = $this->configManager->hasConfig();
        $schemaVersion = null;
        if ($contractExists) {
            $config = $this->configManager->get();
            $schemaVersion = $config['schema_version'] ?? null;
        }

        $devProbe = $this->probeDevServer($hmrEnabled, $env);

        $results = [
            $this->diagnostics->evaluateMode($mode),
            $this->diagnostics->evaluateContract($contractExists, $schemaVersion, ConfigInterface::SCHEMA_VERSION),
            $this->diagnostics->evaluateHmr($mode, $hmrEnabled),
            $this->diagnostics->evaluateDevServer($hmrEnabled, $devProbe),
            $this->diagnostics->evaluateEnv($this->findMissingEnvVars($env)),
        ];

        // Drift only makes sense to evaluate against an existing contract; the
        // missing-contract case is already reported by evaluateContract above.
        if ($contractExists) {
            $results[] = $this->diagnostics->evaluateDrift($this->configManager->detectDrift());
        }

        $this->renderResults($io, $results);

        if ($this->diagnostics->hasError($results)) {
            $io->error('One or more checks failed. See the hints above.');
            return Command::FAILURE;
        }
        $io->success('Dev environment looks healthy.');
        return Command::SUCCESS;
    }

    /**
     * Probe the Vite dev server at the host:port from vite/.env. The dev server's
     * own listener is plain HTTP (the secure flag only affects the browser HMR
     * protocol), so the probe uses http regardless.
     *
     * @param array<string, string> $env
     */
    private function probeDevServer(bool $hmrEnabled, array $env): ProbeResult
    {
        if (!$hmrEnabled) {
            return new ProbeResult(true);
        }
        $host = $env['VITE_SERVER_HOST'] ?? '';
        $port = $env['VITE_SERVER_PORT'] ?? '';
        if ($host === '' || $port === '') {
            return new ProbeResult(false, 0, '', 'VITE_SERVER_HOST/VITE_SERVER_PORT not set in vite/.env');
        }

        return $this->prober->probe(sprintf('http://%s:%s/@vite/client', $host, $port));
    }

    /**
     * @return array<string, string>
     */
    private function parseEnv(): array
    {
        $envPath = $this->directoryList->getRoot() . '/vite/.env';
        if (!$this->fileDriver->isExists($envPath)) {
            return [];
        }

        $env = [];
        foreach (preg_split('/\r\n|\r|\n/', $this->fileDriver->fileGetContents($envPath)) ?: [] as $line) {
            if (preg_match('/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/', $line, $m)) {
                $env[$m[1]] = trim($m[2]);
            }
        }

        return $env;
    }

    /**
     * @param array<string, string> $env
     * @return string[]
     */
    private function findMissingEnvVars(array $env): array
    {
        $missing = [];
        foreach (self::REQUIRED_ENV_VARS as $var) {
            if (!isset($env[$var]) || $env[$var] === '') {
                $missing[] = $var;
            }
        }

        return $missing;
    }

    /**
     * @param CheckResult[] $results
     */
    private function renderResults(CustomSymfonyStyle $io, array $results): void
    {
        $icons = [
            CheckResult::STATUS_OK => '<fg=green>✔ OK</>',
            CheckResult::STATUS_WARN => '<fg=yellow>! WARN</>',
            CheckResult::STATUS_ERROR => '<fg=red>✖ ERROR</>',
        ];

        $rows = [];
        foreach ($results as $result) {
            $detail = $result->message;
            if ($result->hint !== '') {
                $detail .= "\n→ " . $result->hint;
            }
            $rows[] = [$icons[$result->status] ?? $result->status, $result->name, $detail];
        }

        $io->table(['Status', 'Check', 'Detail'], $rows);
    }
}
