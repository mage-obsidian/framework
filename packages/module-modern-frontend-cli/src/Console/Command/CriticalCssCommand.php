<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console\Command;

use Magento\Framework\App\Area;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\State;
use Magento\Framework\Filesystem\DriverInterface;
use Magento\Framework\HTTP\Client\Curl;
use Magento\Framework\UrlInterface;
use Magento\Framework\View\Asset\Repository as AssetRepository;
use Magento\Store\Model\App\Emulation;
use Magento\Store\Model\StoreManagerInterface;
use MageObsidian\ModernFrontend\Model\Config\ConfigProvider;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Renders a layout handle from the live store and extracts its above-the-fold
 * critical CSS into `<theme>/web/critical/<handle>.css`, outside the Vite output
 * that every build empties, the file
 * {@see \MageObsidian\ModernFrontend\Service\CriticalCssProvider} inlines.
 *
 * The Beasties extraction runs in the node bin shipped with the JS engine
 * (`mage-obsidian/cli/criticalCss`); this command only orchestrates it: it
 * fetches the real HTML and hands it the built stylesheet. The relative
 * `@font-face` `url(../*.woff2)` stays as the build emitted it: the provider
 * points it at the serving store's static path when it inlines the file, so a
 * critical CSS committed from one environment works in any other.
 */
class CriticalCssCommand extends Command
{
    private const OPTION_HANDLE = 'handle';
    private const OPTION_URL = 'url';
    private const OPTION_STORE = 'store';
    private const OPTION_INSECURE = 'insecure';
    private const OPTION_RESOLVE = 'resolve';
    private const OPTION_COOKIE = 'cookie';
    private const OPTION_BIN = 'bin';
    private const OPTION_NODE = 'node';
    private const OPTION_MIN_COVERAGE = 'min-coverage';

    private const DEFAULT_HANDLE = 'cms_index_index';
    private const CRITICAL_DIR = 'critical';
    private const STYLE_FILE = 'css/style.css';
    private const DEFAULT_BIN = 'vite/node_modules/mage-obsidian/dist/cli/criticalCss.js';

    public function __construct(
        private readonly State $state,
        private readonly Emulation $emulation,
        private readonly StoreManagerInterface $storeManager,
        private readonly AssetRepository $assetRepository,
        private readonly ConfigProvider $configProvider,
        private readonly Curl $httpClient,
        private readonly DriverInterface $fileDriver,
        private readonly DirectoryList $directoryList
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:frontend:critical-css')
            ->setDescription('Extract above-the-fold critical CSS for a layout handle into the theme\'s web/critical dir.')
            ->addOption(
                self::OPTION_HANDLE,
                null,
                InputOption::VALUE_REQUIRED,
                'Layout handle the critical CSS is for.',
                self::DEFAULT_HANDLE
            )
            ->addOption(
                self::OPTION_URL,
                null,
                InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY,
                'URL to render; repeat it once per page shape the handle serves '
                . '(default: store secure base URL).'
            )
            ->addOption(
                self::OPTION_MIN_COVERAGE,
                null,
                InputOption::VALUE_REQUIRED,
                'Fail when the critical CSS covers less than this share (0..1) of the styled classes.',
                '0'
            )
            ->addOption(
                self::OPTION_STORE,
                null,
                InputOption::VALUE_REQUIRED,
                'Store code/id to emulate (default: default store view).'
            )
            ->addOption(
                self::OPTION_INSECURE,
                null,
                InputOption::VALUE_NONE,
                'Skip TLS verification (self-signed dev certs).'
            )
            ->addOption(
                self::OPTION_RESOLVE,
                null,
                InputOption::VALUE_REQUIRED,
                'curl --resolve entry "host:port:ip" (dev).'
            )
            ->addOption(
                self::OPTION_COOKIE,
                null,
                InputOption::VALUE_REQUIRED,
                'Cookie header for handles that need a session (a checkout needs a cart with items).'
            )
            ->addOption(self::OPTION_BIN, null, InputOption::VALUE_REQUIRED, 'Path to the node critical-css bin.')
            ->addOption(self::OPTION_NODE, null, InputOption::VALUE_REQUIRED, 'node binary.', 'node');

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);
        $handle = strtolower(trim((string)$input->getOption(self::OPTION_HANDLE)));
        if ($handle === '' || preg_match('/[^a-z0-9_]/', $handle)) {
            $io->error('Invalid handle. Allowed characters: [a-z0-9_].');
            return Command::FAILURE;
        }

        try {
            $storeOption = $input->getOption(self::OPTION_STORE);
            $store = $storeOption !== null
                ? $this->storeManager->getStore($storeOption)
                : ($this->storeManager->getDefaultStoreView() ?? $this->storeManager->getStore());
            $storeId = (int)$store->getId();

            $bytes = $this->state->emulateAreaCode(
                Area::AREA_FRONTEND,
                function () use ($input, $io, $handle, $store, $storeId): int {
                    $this->emulation->startEnvironmentEmulation($storeId, Area::AREA_FRONTEND, true);
                    try {
                        return $this->generate($input, $io, $handle, $store);
                    } finally {
                        $this->emulation->stopEnvironmentEmulation();
                    }
                }
            );
        } catch (Throwable $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        if ($bytes < 0) {
            return Command::FAILURE;
        }

        $io->success(sprintf('Critical CSS for "%s": %d bytes written.', $handle, $bytes));
        return Command::SUCCESS;
    }

    /**
     * @param InputInterface $input
     * @param CustomSymfonyStyle $io
     * @param string $handle
     * @param \Magento\Store\Api\Data\StoreInterface $store
     * @return int Bytes written, or -1 on a handled failure.
     */
    private function generate(InputInterface $input, CustomSymfonyStyle $io, string $handle, $store): int
    {
        $styleSource = $this->assetRepository
            ->createAsset($this->configProvider->getViteGeneratedPath() . '/' . self::STYLE_FILE)
            ->getSourceFile();
        if (!$this->fileDriver->isExists($styleSource)) {
            $io->error('Built stylesheet not found at ' . $styleSource . '. Build the theme first.');
            return -1;
        }

        $urls = array_values(array_filter((array)$input->getOption(self::OPTION_URL)));
        if ($urls === []) {
            $urls = [rtrim($store->getBaseUrl(UrlInterface::URL_TYPE_LINK, true), '/') . '/'];
        }

        $work = $this->directoryList->getPath(DirectoryList::VAR_DIR) . '/mage_obsidian_critical';
        if (!$this->fileDriver->isExists($work)) {
            $this->fileDriver->createDirectory($work);
        }
        $cssTmp = $work . '/' . $handle . '.src.css';
        $outTmp = $work . '/' . $handle . '.out.css';
        $htmlTmps = [];
        foreach ($urls as $index => $url) {
            $html = $this->fetch(
                $url,
                (bool)$input->getOption(self::OPTION_INSECURE),
                $input->getOption(self::OPTION_RESOLVE),
                $input->getOption(self::OPTION_COOKIE)
            );
            if (!$this->servesHandle($html, $handle)) {
                $io->error(sprintf(
                    '%s did not render "%s" — it redirected or served another page. '
                    . 'Pass a --url that renders the handle (a checkout needs a cart with items).',
                    $url,
                    $handle
                ));

                return -1;
            }
            $htmlTmp = $work . '/' . $handle . '.' . $index . '.html';
            $this->fileDriver->filePutContents($htmlTmp, $html);
            $htmlTmps[] = $htmlTmp;
        }
        $this->fileDriver->filePutContents($cssTmp, $this->fileDriver->fileGetContents($styleSource));

        $bin = (string)($input->getOption(self::OPTION_BIN) ?: $this->directoryList->getRoot() . '/' . self::DEFAULT_BIN);
        if (!$this->fileDriver->isExists($bin)) {
            $io->error('node critical-css bin not found at ' . $bin . '. Build the JS engine or pass --bin.');
            return -1;
        }

        $command = [(string)$input->getOption(self::OPTION_NODE), $bin];
        foreach ($htmlTmps as $htmlTmp) {
            $command[] = '--html';
            $command[] = $htmlTmp;
        }
        array_push(
            $command,
            '--css',
            $cssTmp,
            '--out',
            $outTmp,
            '--min-coverage',
            (string)$input->getOption(self::OPTION_MIN_COVERAGE)
        );

        $process = new Process($command);
        $process->setTimeout(180.0);
        $process->run();
        if (!$process->isSuccessful()) {
            $io->error(
                'critical-css extraction failed: ' . trim($process->getErrorOutput() ?: $process->getOutput())
            );
            return -1;
        }
        $io->info(trim($process->getOutput()));

        $critical = (string)$this->fileDriver->fileGetContents($outTmp);
        if (trim($critical) === '') {
            $io->warning('Extractor produced empty critical CSS; nothing written.');
            return -1;
        }

        $outPath = self::criticalPathFor($styleSource, $handle);
        $outDir = $this->fileDriver->getParentDirectory($outPath);
        if (!$this->fileDriver->isExists($outDir)) {
            $this->fileDriver->createDirectory($outDir);
        }
        $this->fileDriver->filePutContents($outPath, $critical);
        $io->info('Wrote ' . $outPath);

        foreach ([...$htmlTmps, $cssTmp, $outTmp] as $tmp) {
            if ($this->fileDriver->isExists($tmp)) {
                $this->fileDriver->deleteFile($tmp);
            }
        }

        return strlen($critical);
    }

    public static function criticalPathFor(string $styleSource, string $handle): string
    {
        return dirname($styleSource, 3) . '/' . self::CRITICAL_DIR . '/' . $handle . '.css';
    }

    public function servesHandle(string $html, string $handle): bool
    {
        if (!preg_match('/<body\b[^>]*\bclass\s*=\s*("([^"]*)"|\'([^\']*)\')/i', $html, $match)) {
            return true;
        }

        $attribute = trim(($match[2] ?? '') !== '' ? $match[2] : ($match[3] ?? ''));
        if ($attribute === '') {
            return true;
        }

        return in_array(str_replace('_', '-', $handle), preg_split('/\s+/', $attribute) ?: [], true);
    }

    private function fetch(string $url, bool $insecure, ?string $resolve, ?string $cookie = null): string
    {
        $options = [CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 30];
        if ($cookie !== null && $cookie !== '') {
            $options[CURLOPT_COOKIE] = $cookie;
        }
        if ($insecure) {
            $options[CURLOPT_SSL_VERIFYPEER] = false;
            $options[CURLOPT_SSL_VERIFYHOST] = 0;
        }
        if ($resolve !== null && $resolve !== '') {
            $options[CURLOPT_RESOLVE] = [$resolve];
        }
        $this->httpClient->setOptions($options);
        $this->httpClient->get($url);

        $status = $this->httpClient->getStatus();
        if ($status < 200 || $status >= 400) {
            throw new \RuntimeException(sprintf('Failed to fetch %s (HTTP %d).', $url, $status));
        }

        return $this->httpClient->getBody();
    }
}
