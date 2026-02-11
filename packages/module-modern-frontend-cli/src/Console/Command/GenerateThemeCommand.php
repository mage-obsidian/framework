<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console\Command;

use MageObsidian\ModernFrontendCli\Service\ScaffoldGenerator;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\Exception\FileSystemException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Scaffolds a new frontend theme under app/design pre-wired for MageObsidian:
 * registration, theme.xml (with optional parent), the compatibility opt-in, a
 * theme.config.js, and a Tailwind 4 theme.source.css.
 */
class GenerateThemeCommand extends Command
{
    private const string PATH_PATTERN = '/^[A-Z][A-Za-z0-9]+\/[A-Za-z0-9][\w-]*$/';

    public function __construct(
        private readonly DirectoryList $directoryList,
        private readonly ScaffoldGenerator $generator
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:generate:theme')
             ->setDescription('Generate a new frontend theme under app/design pre-wired for MageObsidian.')
             ->addArgument('path', InputArgument::REQUIRED, 'Theme code in Vendor/theme form (e.g. Acme/aurora).')
             ->addOption('parent', null, InputOption::VALUE_REQUIRED, 'Parent theme (e.g. Magento/blank).')
             ->addOption('title', null, InputOption::VALUE_REQUIRED, 'Human-readable theme title.')
             ->addOption('force', 'f', InputOption::VALUE_NONE, 'Overwrite files if they already exist.');

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);
        $path = (string)$input->getArgument('path');
        $parent = $input->getOption('parent');
        $title = $input->getOption('title');
        $force = (bool)$input->getOption('force');

        if (!preg_match(self::PATH_PATTERN, $path)) {
            $io->error(sprintf('Invalid theme code "%s". Expected Vendor/theme (e.g. Acme/aurora).', $path));
            return Command::FAILURE;
        }

        $themeDir = $this->directoryList->getRoot() . '/app/design/frontend/' . $path;
        $parentXml = $parent ? sprintf("\n    <parent>%s</parent>", $parent) : '';

        $replacements = [
            'THEME_PATH' => $path,
            'THEME_TITLE' => $title ?: str_replace('/', ' - ', $path),
            'PARENT' => $parentXml,
        ];

        try {
            $files = [
                'registration.php' => 'theme/registration.php.tpl',
                'theme.xml' => 'theme/theme.xml.tpl',
                'etc/mage_obsidian_compatibility.xml' => 'theme/mage_obsidian_compatibility.xml.tpl',
                'web/theme.config.js' => 'theme/theme.config.js.tpl',
                'web/css/theme.source.css' => 'theme/theme.source.css.tpl',
                'jsconfig.json' => 'theme/jsconfig.json.tpl',
                '.gitignore' => 'theme/gitignore.tpl',
            ];

            $created = [];
            foreach ($files as $relative => $template) {
                $absolute = $themeDir . '/' . $relative;
                if (!$this->generator->write($absolute, $this->generator->render($template, $replacements), $force)) {
                    $io->error(sprintf('%s already exists. Use --force to overwrite.', $absolute));
                    return Command::FAILURE;
                }
                $created[] = [$relative];
            }
        } catch (FileSystemException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        $io->info(sprintf('Theme %s created at %s', $path, $themeDir));
        $io->table(['Files generated'], $created);
        $io->note(
            "Next steps:\n"
            . "    Activate the theme in Content > Design > Configuration (or via config),\n"
            . "    then: bin/magento mage-obsidian:frontend:config --generate"
        );

        return Command::SUCCESS;
    }
}
