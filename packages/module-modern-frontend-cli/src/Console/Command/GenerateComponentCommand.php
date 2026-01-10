<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

declare(strict_types=1);

namespace MageObsidian\ModernFrontendCli\Console\Command;

use MageObsidian\ModernFrontend\Service\ConfigManager;
use MageObsidian\ModernFrontendCli\Service\ScaffoldGenerator;
use MageObsidian\ModernFrontendCli\Utils\CustomSymfonyStyle;
use Magento\Framework\App\State;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Exception\LocalizedException;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Scaffolds a Vue single-file component into an enabled, compatible module or
 * theme, following the framework's filesystem convention (so the resolver picks
 * it up with no registration). The component is referenced from phtml/layout via
 * the `Namespace::name` notation; `--wire` also emits a phtml stub.
 */
class GenerateComponentCommand extends Command
{
    private const string MODULE_COMPONENTS_PATH = 'view/frontend/web/components';
    private const string MODULE_TEMPLATES_PATH = 'view/frontend/templates';
    private const string THEME_COMPONENTS_PATH = 'web/components';
    private const string THEME_TEMPLATES_PATH = 'Magento_Theme/templates';
    private const string THEME_NAMESPACE = 'Theme';

    public function __construct(
        private readonly State $state,
        private readonly ConfigManager $configManager,
        private readonly ScaffoldGenerator $generator
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->setName('mage-obsidian:generate:component')
             ->setDescription('Generate a Vue component wired for the MageObsidian frontend.')
             ->addArgument(
                 'name',
                 InputArgument::REQUIRED,
                 'Component name or path under components/ (e.g. Button or elements/Button).'
             )
             ->addOption('module', null, InputOption::VALUE_REQUIRED, 'Target module (Vendor_Module).')
             ->addOption('theme', null, InputOption::VALUE_REQUIRED, 'Target theme (Vendor/theme).')
             ->addOption('wire', null, InputOption::VALUE_NONE, 'Also generate a phtml stub that renders the component.')
             ->addOption('force', 'f', InputOption::VALUE_NONE, 'Overwrite files if they already exist.');

        parent::configure();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new CustomSymfonyStyle($input, $output);
        $module = $input->getOption('module');
        $theme = $input->getOption('theme');
        $wire = (bool)$input->getOption('wire');
        $force = (bool)$input->getOption('force');

        if (($module && $theme) || (!$module && !$theme)) {
            $io->error('Provide exactly one target: --module=Vendor_Module or --theme=Vendor/theme.');
            return Command::FAILURE;
        }

        $name = $this->normalizeName((string)$input->getArgument('name'));
        if ($name === '') {
            $io->error('Component name cannot be empty.');
            return Command::FAILURE;
        }

        $baseName = basename($name);
        $componentName = $this->toPascalCase($baseName);

        try {
            $this->state->setAreaCode('global');

            $target = $this->resolveTarget($io, $module, $theme);
            if ($target === null) {
                return Command::FAILURE;
            }
            [$namespace, $srcDir] = $target;

            $vuePath = $srcDir . '/' . self::componentsPath($module !== null) . '/' . $name . '.vue';
            $written = $this->generator->write(
                $vuePath,
                $this->generator->render('component.vue.tpl', [
                    'COMPONENT_NAME' => $componentName,
                    'KEBAB' => $this->toKebab($baseName),
                ]),
                $force
            );

            if (!$written) {
                $io->error(sprintf('%s already exists. Use --force to overwrite.', $vuePath));
                return Command::FAILURE;
            }

            $reference = $namespace . '::' . $name;
            $io->info(sprintf('Component created: %s', $vuePath));

            if ($wire) {
                $this->wire($io, (string)($module ?? $theme), $module !== null, $srcDir, $baseName, $reference, $force);
            } else {
                $io->note(sprintf("Render it from a phtml with:\n    \$block->renderVueComponent('%s')", $reference));
            }
        } catch (FileSystemException|LocalizedException $e) {
            $io->error($e->getMessage());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }

    /**
     * @return array{0: string, 1: string}|null Tuple of [namespace, srcDir], or
     *                                          null when the target is invalid.
     * @throws FileSystemException
     * @throws LocalizedException
     */
    private function resolveTarget(CustomSymfonyStyle $io, ?string $module, ?string $theme): ?array
    {
        $config = $this->configManager->get();

        if ($module !== null) {
            if (!$this->configManager->isModuleEnabled($module)) {
                $io->error(sprintf(
                    'Module "%s" is not an enabled, frontend-compatible module. '
                    . 'Ensure it ships etc/mage_obsidian_compatibility.xml and run '
                    . 'mage-obsidian:frontend:config --generate.',
                    $module
                ));
                return null;
            }
            return [$module, $config['modules'][$module]['src']];
        }

        if (!$this->configManager->isThemeEnabled($theme)) {
            $io->error(sprintf(
                'Theme "%s" is not an enabled, frontend-compatible theme. '
                . 'Ensure it ships etc/mage_obsidian_compatibility.xml and run '
                . 'mage-obsidian:frontend:config --generate.',
                $theme
            ));
            return null;
        }
        return [self::THEME_NAMESPACE, $config['themes'][$theme]['src']];
    }

    /**
     * @throws FileSystemException
     */
    private function wire(
        CustomSymfonyStyle $io,
        string $target,
        bool $isModule,
        string $srcDir,
        string $baseName,
        string $reference,
        bool $force
    ): void {
        $templatesPath = $isModule ? self::MODULE_TEMPLATES_PATH : self::THEME_TEMPLATES_PATH;
        $phtmlName = $this->toKebab($baseName) . '.phtml';
        $phtmlPath = $srcDir . '/' . $templatesPath . '/' . $phtmlName;

        $written = $this->generator->write(
            $phtmlPath,
            $this->generator->render('component.phtml.tpl', ['REF' => $reference]),
            $force
        );

        if (!$written) {
            $io->note(sprintf('phtml already exists, left untouched: %s (use --force to overwrite).', $phtmlPath));
        } else {
            $io->info(sprintf('Template created: %s', $phtmlPath));
        }

        $templateRef = ($isModule ? $target : 'Magento_Theme') . '::' . $phtmlName;
        $io->note(sprintf(
            "Add a block to a layout handle to render it, e.g.:\n"
            . "    <referenceContainer name=\"content\">\n"
            . "        <block class=\"MageObsidian\\ModernFrontend\\Block\\Template\"\n"
            . "               name=\"%s\"\n"
            . "               template=\"%s\"/>\n"
            . "    </referenceContainer>",
            strtolower(str_replace(['_', '/'], '.', $target)) . '.' . $this->toKebab($baseName),
            $templateRef
        ));
    }

    private function normalizeName(string $name): string
    {
        $name = trim(str_replace('\\', '/', $name), '/');
        $name = preg_replace('/^components\//', '', $name);
        return preg_replace('/\.vue$/', '', $name);
    }

    private function componentsPath(bool $isModule): string
    {
        return $isModule ? self::MODULE_COMPONENTS_PATH : self::THEME_COMPONENTS_PATH;
    }

    private function toPascalCase(string $value): string
    {
        return str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $value)));
    }

    private function toKebab(string $value): string
    {
        $value = preg_replace('/(?<!^)([A-Z])/', '-$1', $value);
        return strtolower(str_replace(['_', ' '], '-', $value));
    }
}
