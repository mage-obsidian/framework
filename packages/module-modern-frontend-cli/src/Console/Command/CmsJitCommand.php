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
use Magento\Framework\App\State;
use Magento\Framework\Exception\LocalizedException;
use MageObsidian\ModernFrontend\Service\Cms\DeltaStylesheet;
use MageObsidian\ModernFrontend\Service\Cms\TailwindCli;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Rebuilds the stylesheet for the Tailwind classes written in CMS content after
 * the theme was built. Runs by itself on save and on cron; this is for deploys
 * and for finding out why a class is not showing up.
 */
class CmsJitCommand extends Command
{
    private const string OPTION_SHOW = 'show';

    public function __construct(
        private readonly State $state,
        private readonly DeltaStylesheet $delta,
        private readonly TailwindCli $tailwind
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:cms:jit')
            ->setDescription('Rebuild the CSS for Tailwind classes written in CMS content after the last build.')
            ->addOption(self::OPTION_SHOW, null, InputOption::VALUE_NONE, 'Report the current state without rebuilding.');

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);

        try {
            // The delta is compiled against the frontend theme, so the area has
            // to be the storefront's for the theme fallback to resolve at all.
            $this->state->setAreaCode(Area::AREA_FRONTEND);
        } catch (LocalizedException) {
            // already set
        }

        if (!$this->tailwind->isAvailable()) {
            $io->warning(
                'The Tailwind CLI is not at ' . $this->tailwind->getBinaryPath() . '. '
                . 'Classes written in CMS content after the last theme build will not be generated. '
                . 'See the CMS docs for the one-line install.'
            );
        }

        $state = $input->getOption(self::OPTION_SHOW)
            ? $this->delta->state()
            : $this->delta->regenerate();

        $io->info('Stylesheet: pub/media/' . $this->delta->relativePath());
        $io->table(
            ['Classes', 'Bytes', 'Themes', 'Unresolved'],
            [[$state['classes'], $state['bytes'], $state['themes'] ?? 1, count($state['unresolved'])]]
        );

        if ($state['unresolved'] !== []) {
            $io->warning(
                'Tailwind generated no rule for these classes, so they will not apply: '
                . implode(', ', $state['unresolved'])
            );
        }

        if ($state['classes'] === 0) {
            $io->success('No delta: the build already covers every class in CMS content.');

            return Command::SUCCESS;
        }

        $io->success(sprintf('%d class(es) generated on the fly.', $state['classes']));

        return Command::SUCCESS;
    }
}
