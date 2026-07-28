<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Console\Command;

use MageObsidian\ModernFrontendTwig\Model\Template\TemplateNamespaces;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Dumps the Twig namespace table. Most of it is derived from the enabled module
 * list rather than declared, so without this there is no way to know which
 * aliases exist — or which short ones were lost to a collision.
 */
class TwigNamespacesCommand extends Command
{
    private const string OPTION_FILTER = 'filter';

    /**
     * @param TemplateNamespaces $namespaces
     */
    public function __construct(
        private readonly TemplateNamespaces $namespaces
    ) {
        parent::__construct();
    }

    /**
     * @inheritDoc
     */
    protected function configure(): void
    {
        $this->setName('mage-obsidian:twig:namespaces')
            ->setDescription('Show the Twig template namespaces (@alias/path.twig) and their modules.')
            ->addOption(
                self::OPTION_FILTER,
                'f',
                InputOption::VALUE_REQUIRED,
                'Only show aliases or modules containing this string.'
            );

        parent::configure();
    }

    /**
     * @inheritDoc
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $filter = (string)$input->getOption(self::OPTION_FILTER);

        $rows = [];
        foreach ($this->namespaces->getAll() as $alias => $module) {
            if ($filter !== '' && !str_contains($alias, $filter) && !str_contains($module, $filter)) {
                continue;
            }
            $rows[] = [TemplateNamespaces::PREFIX . $alias, $module];
        }

        if ($rows === []) {
            $io->warning($filter === '' ? 'No namespaces registered.' : sprintf('No namespace matches "%s".', $filter));

            return Command::SUCCESS;
        }

        $io->table(['Namespace', 'Module'], $rows);
        $io->text(sprintf('%d namespace(s). Use them as {%% include \'@alias/path.twig\' %%}.', count($rows)));

        $this->reportAmbiguous($io);

        return Command::SUCCESS;
    }

    /**
     * @param SymfonyStyle $io
     *
     * @return void
     */
    private function reportAmbiguous(SymfonyStyle $io): void
    {
        $ambiguous = $this->namespaces->getAmbiguous();
        if ($ambiguous === []) {
            return;
        }

        $lines = [];
        foreach ($ambiguous as $alias => $modules) {
            $lines[] = sprintf(
                '%s%s is claimed by %s',
                TemplateNamespaces::PREFIX,
                $alias,
                implode(' and ', $modules)
            );
        }

        $io->warning(array_merge(
            ['Short namespaces not registered because more than one module claims them:'],
            $lines,
            ['Use the vendor-qualified form, or assign one in di.xml (TemplateNamespaces::$namespaces).']
        ));
    }
}
