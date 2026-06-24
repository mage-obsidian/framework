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
 * critical CSS into `<theme>/web/generated/critical/<handle>.css`, the file
 * {@see \MageObsidian\ModernFrontend\Service\CriticalCssProvider} inlines.
 *
 * The Beasties extraction runs in the node bin shipped with the JS engine
 * (`mage-obsidian/cli/criticalCss`); this command only orchestrates it: it
 * fetches the real HTML, hands it the built stylesheet, and rewrites the
 * relative `@font-face` `url(../*.woff2)` to a root-relative static URL so the
 * font resolves once the critical CSS is inlined in `<head>` (a relative URL
 * would resolve against the document and 404).
 */
class CriticalCssCommand extends Command
{
    private const OPTION_HANDLE = 'handle';
    private const OPTION_URL = 'url';
    private const OPTION_STORE = 'store';
    private const OPTION_INSECURE = 'insecure';
    private const OPTION_RESOLVE = 'resolve';
    private const OPTION_BIN = 'bin';
    private const OPTION_NODE = 'node';

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
            ->setDescription('Extract above-the-fold critical CSS for a layout handle into the Vite generated dir.')
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
                InputOption::VALUE_REQUIRED,
                'URL to render (default: store secure base URL).'
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

        $url = (string)($input->getOption(self::OPTION_URL)
            ?: rtrim($store->getBaseUrl(UrlInterface::URL_TYPE_LINK, true), '/') . '/');
        $html = $this->fetch(
            $url,
            (bool)$input->getOption(self::OPTION_INSECURE),
            $input->getOption(self::OPTION_RESOLVE)
        );

        $work = $this->directoryList->getPath(DirectoryList::VAR_DIR) . '/mage_obsidian_critical';
        if (!$this->fileDriver->isExists($work)) {
            $this->fileDriver->createDirectory($work);
        }
        $htmlTmp = $work . '/' . $handle . '.html';
        $cssTmp = $work . '/' . $handle . '.src.css';
        $outTmp = $work . '/' . $handle . '.out.css';
        $this->fileDriver->filePutContents($htmlTmp, $html);
        $this->fileDriver->filePutContents($cssTmp, $this->fileDriver->fileGetContents($styleSource));

        $bin = (string)($input->getOption(self::OPTION_BIN) ?: $this->directoryList->getRoot() . '/' . self::DEFAULT_BIN);
        if (!$this->fileDriver->isExists($bin)) {
            $io->error('node critical-css bin not found at ' . $bin . '. Build the JS engine or pass --bin.');
            return -1;
        }

        $process = new Process([
            (string)$input->getOption(self::OPTION_NODE),
            $bin,
            '--html', $htmlTmp,
            '--css', $cssTmp,
            '--out', $outTmp,
        ]);
        $process->setTimeout(180.0);
        $process->run();
        if (!$process->isSuccessful()) {
            $io->error(
                'critical-css extraction failed: ' . trim($process->getErrorOutput() ?: $process->getOutput())
            );
            return -1;
        }

        $critical = $this->rewriteFontUrls((string)$this->fileDriver->fileGetContents($outTmp));
        if (trim($critical) === '') {
            $io->warning('Extractor produced empty critical CSS; nothing written.');
            return -1;
        }

        $generatedDir = $this->fileDriver->getParentDirectory(
            $this->fileDriver->getParentDirectory($styleSource)
        );
        $outPath = $generatedDir . '/' . self::CRITICAL_DIR . '/' . $handle . '.css';
        $outDir = $this->fileDriver->getParentDirectory($outPath);
        if (!$this->fileDriver->isExists($outDir)) {
            $this->fileDriver->createDirectory($outDir);
        }
        $this->fileDriver->filePutContents($outPath, $critical);
        $io->info('Wrote ' . $outPath);

        foreach ([$htmlTmp, $cssTmp, $outTmp] as $tmp) {
            if ($this->fileDriver->isExists($tmp)) {
                $this->fileDriver->deleteFile($tmp);
            }
        }

        return strlen($critical);
    }

    private function fetch(string $url, bool $insecure, ?string $resolve): string
    {
        $options = [CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 30];
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

    /**
     * Repoint the relative `url(../*.woff2)` the build emitted to a root-relative
     * static URL, so the `@font-face` resolves from `<head>` instead of against
     * the document path. The URL matches the one fonts.twig preloads.
     *
     * @param string $critical
     * @return string
     */
    private function rewriteFontUrls(string $critical): string
    {
        return (string)preg_replace_callback(
            '#url\(\s*([\'"]?)\.\./([A-Za-z0-9._-]+\.woff2)\1\s*\)#',
            fn (array $m): string => 'url(' . $this->fontUrl($m[2]) . ')',
            $critical
        );
    }

    private function fontUrl(string $name): string
    {
        $fileId = $this->configProvider->getViteGeneratedPath() . '/' . $name;
        $url = (string)preg_replace(
            '/\s+/',
            '',
            $this->assetRepository->getUrlWithParams($fileId, ['_secure' => true])
        );

        // Strip scheme+host so the @font-face resolves against the serving origin
        // (avoids mixed content and a hardcoded host in the inlined critical CSS).
        return (string)preg_replace('#^https?://[^/]+#i', '', $url);
    }
}
