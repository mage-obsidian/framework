<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console\Command;

use Magento\Framework\App\State;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Filesystem\DriverInterface;
use MageObsidian\ModernFrontend\Api\ConfigManagerInterface;
use MageObsidian\ModernFrontend\Service\I18n\CsvDictionary;
use MageObsidian\ModernFrontend\Service\I18n\VuePhraseExtractor;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Collects `$t('...')` phrases from the `.vue` sources of every compatible
 * module/theme and merges them into the standard Magento `i18n/<locale>.csv`
 * dictionary of each component. New phrases default to themselves so they reach
 * `js-translation.json` through the native deploy once translated.
 */
class I18nCollectCommand extends Command
{
    private const OPTION_LOCALE = 'locale';
    private const DEFAULT_LOCALE = 'en_US';

    public function __construct(
        private readonly State $state,
        private readonly ConfigManagerInterface $configManager,
        private readonly VuePhraseExtractor $extractor,
        private readonly CsvDictionary $csvDictionary,
        private readonly DriverInterface $fileDriver
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:i18n:collect')
            ->setDescription('Collect translatable $t() phrases from .vue files into each component i18n CSV.')
            ->addOption(
                self::OPTION_LOCALE,
                null,
                InputOption::VALUE_REQUIRED,
                'Locale of the CSV dictionary to write (e.g. en_US).',
                self::DEFAULT_LOCALE
            );

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);
        $locale = (string)$input->getOption(self::OPTION_LOCALE);

        try {
            $this->state->setAreaCode('global');
            $components = $this->collectComponents();

            $rows = [];
            $grandTotalNew = 0;
            foreach ($components as $label => $src) {
                $phrases = $this->extractPhrasesFrom($src);
                if ($phrases === []) {
                    continue;
                }
                $csvPath = $src . '/i18n/' . $locale . '.csv';
                $existing = $this->fileDriver->isExists($csvPath)
                    ? $this->csvDictionary->parse($this->fileDriver->fileGetContents($csvPath))
                    : [];

                $newCount = $this->csvDictionary->countNew($existing, $phrases);
                $merged = $this->csvDictionary->merge($existing, $phrases);
                $this->writeCsv($csvPath, $this->csvDictionary->render($merged));

                $grandTotalNew += $newCount;
                $rows[] = [$label, count($phrases), $newCount, $csvPath];
            }

            if ($rows === []) {
                $io->warning('No $t() phrases found in any .vue source.');
                return Command::SUCCESS;
            }

            $io->info('Collected phrases for locale: ' . $locale);
            $io->table(['Component', 'Phrases', 'New', 'CSV'], $rows);
            $io->success(sprintf('%d new phrase(s) added across %d component(s).', $grandTotalNew, count($rows)));
        } catch (FileSystemException|LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    /**
     * Map of "type:name" => source path for every compatible module and theme.
     *
     * @return array<string, string>
     * @throws FileSystemException
     * @throws LocalizedException
     */
    private function collectComponents(): array
    {
        $config = $this->configManager->get();
        $components = [];
        foreach (['modules', 'themes'] as $type) {
            foreach ($config[$type] ?? [] as $name => $definition) {
                if (!empty($definition['src'])) {
                    $components[$type . ':' . $name] = rtrim((string)$definition['src'], '/');
                }
            }
        }

        return $components;
    }

    /**
     * Extract the unique phrases from every `.vue` file under a component root.
     *
     * @param string $root
     * @return string[]
     * @throws FileSystemException
     */
    private function extractPhrasesFrom(string $root): array
    {
        if (!$this->fileDriver->isExists($root) || !$this->fileDriver->isDirectory($root)) {
            return [];
        }

        $phrases = [];
        foreach ($this->fileDriver->readDirectoryRecursively($root) as $path) {
            if (!str_ends_with($path, '.vue')
                || str_contains($path, '/generated/')
                || str_contains($path, '/node_modules/')
            ) {
                continue;
            }
            foreach ($this->extractor->extractFromString($this->fileDriver->fileGetContents($path)) as $phrase) {
                if (!in_array($phrase, $phrases, true)) {
                    $phrases[] = $phrase;
                }
            }
        }

        return $phrases;
    }

    /**
     * @param string $csvPath
     * @param string $contents
     * @return void
     * @throws FileSystemException
     */
    private function writeCsv(string $csvPath, string $contents): void
    {
        $dir = dirname($csvPath);
        if (!$this->fileDriver->isExists($dir)) {
            $this->fileDriver->createDirectory($dir);
        }
        $this->fileDriver->filePutContents($csvPath, $contents);
    }
}
