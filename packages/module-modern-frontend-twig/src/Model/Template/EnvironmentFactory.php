<?php
declare(strict_types=1);
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendTwig\Model\Template;

use Magento\Framework\App\State;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use Twig\Environment;
use Twig\Extension\DebugExtension;
use Twig\Extension\ExtensionInterface;
use UnexpectedValueException;

/**
 * Builds the shared Twig environment.
 *
 * Where compiled templates go, and when they are dropped, belongs to
 * {@see CompiledTemplateCache}. `auto_reload` recompiles a template whose source
 * is newer than the cache, which covers templates edited in place; it is on in
 * every mode because the alternative is silently serving stale HTML. `debug`
 * enables `{{ dump() }}` and `strict_variables` turns an undefined variable into
 * an error instead of a silent empty string, both developer-mode only. HTML
 * auto-escaping is always on — the main security gain over raw phtml. The
 * environment is built once and reused (declared shared in di.xml).
 *
 * Extensions are injected as an array via di.xml (`extensions` argument), which
 * Magento merges across modules by item key — so any module can contribute its
 * own filters/functions without editing this factory (the engine's own
 * MageObsidianExtension and FormatExtension are just two such items). This
 * mirrors how TemplateEngineFactory's `engines` array is extended.
 */
class EnvironmentFactory
{
    private ?Environment $environment = null;

    /**
     * @param FilesystemLoader $loader
     * @param CompiledTemplateCache $compiledTemplateCache
     * @param State $appState
     * @param ExtensionInterface[] $extensions Twig extensions to register, injected via di.xml.
     */
    public function __construct(
        private readonly FilesystemLoader $loader,
        private readonly CompiledTemplateCache $compiledTemplateCache,
        private readonly State $appState,
        private readonly array $extensions = []
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
            'cache' => $this->compiledTemplateCache->getDirectory(),
            'autoescape' => 'html',
            'auto_reload' => true,
            'debug' => $isDeveloper,
            'strict_variables' => $isDeveloper,
        ]);

        foreach ($this->extensions as $key => $extension) {
            // The di.xml array carries no type guarantee; fail with an
            // actionable message instead of an opaque error deep inside Twig.
            if (!$extension instanceof ExtensionInterface) {
                throw new UnexpectedValueException(sprintf(
                    'Twig extension "%s" must implement %s, %s given.',
                    is_string($key) ? $key : (string)$key,
                    ExtensionInterface::class,
                    get_debug_type($extension)
                ));
            }
            $environment->addExtension($extension);
        }

        if ($isDeveloper) {
            $environment->addExtension(new DebugExtension());
        }

        return $this->environment = $environment;
    }
}
