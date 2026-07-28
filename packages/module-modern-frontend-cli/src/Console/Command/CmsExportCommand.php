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
use MageObsidian\ModernFrontend\Service\Cms\ContentExporter;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Exports CMS content to files so the theme build can scan the Tailwind classes
 * written inside it. Run before building a theme; the build reads the exported
 * directory through a `@source` the engine emits.
 */
class CmsExportCommand extends Command
{
    public function __construct(
        private readonly State $state,
        private readonly ContentExporter $exporter
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:cms:export')
            ->setDescription('Export CMS page and block content so Tailwind can scan the classes written in it.');

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);

        try {
            $this->state->setAreaCode('global');
            $result = $this->exporter->export();
        } catch (FileSystemException|LocalizedException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->info('Exported to: ' . $this->exporter->rootPath());
        $io->table(
            ['Pages', 'Blocks', 'Excluded', 'Classes'],
            [[$result['pages'], $result['blocks'], $result['skipped'], count($result['candidates'])]]
        );

        if ($result['pages'] + $result['blocks'] === 0) {
            $io->warning('Nothing was exported. The build will not pick up any CMS class.');

            return Command::SUCCESS;
        }

        $io->success('CMS content exported. Build the theme to pick up its classes.');

        return Command::SUCCESS;
    }
}
