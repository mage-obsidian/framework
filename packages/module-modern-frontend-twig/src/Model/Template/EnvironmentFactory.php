<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\State;
use MageObsidian\ModernFrontendTwig\Model\Template\Extension\MageObsidianExtension;
use Twig\Environment;
use Twig\Extension\DebugExtension;

/**
 * Builds the shared Twig environment.
 *
 * Compiled templates are cached under `var/cache/twig`. In developer mode the
 * cache is kept but `auto_reload` recompiles a template whenever its source
 * changes, `debug` enables `{{ dump() }}`, and `strict_variables` turns an
 * undefined variable into an error instead of a silent empty string. HTML
 * auto-escaping is always on — the main security gain over raw phtml. The
 * environment is built once and reused (declared shared in di.xml).
 */
class EnvironmentFactory
{
    private const CACHE_SUBDIR = 'cache/twig';

    private ?Environment $environment = null;

    /**
     * @param FilesystemLoader $loader
     * @param MageObsidianExtension $extension
     * @param DirectoryList $directoryList
     * @param State $appState
     */
    public function __construct(
        private readonly FilesystemLoader $loader,
        private readonly MageObsidianExtension $extension,
        private readonly DirectoryList $directoryList,
        private readonly State $appState
    ) {
    }

    /**
     * @return Environment
     */
    public function create(): Environment
    {
        if ($this->environment !== null) {
            return $this->environment;
        }

        $isDeveloper = $this->appState->getMode() === State::MODE_DEVELOPER;

        $environment = new Environment($this->loader, [
            'cache' => $this->directoryList->getPath(DirectoryList::VAR_DIR) . '/' . self::CACHE_SUBDIR,
            'autoescape' => 'html',
            'auto_reload' => $isDeveloper,
            'debug' => $isDeveloper,
            'strict_variables' => $isDeveloper,
        ]);

        $environment->addExtension($this->extension);
        if ($isDeveloper) {
            $environment->addExtension(new DebugExtension());
        }

        return $this->environment = $environment;
    }
}
