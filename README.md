# MageObsidian framework

Development monorepo of the MageObsidian framework. Each directory under `packages/` is split on every push to its own read-only repository, which is what Packagist and npm publish:

| Package | Split repository | Registry |
|---|---|---|
| `packages/module-modern-frontend` | mage-obsidian/module-modern-frontend | Packagist |
| `packages/module-modern-frontend-cli` | mage-obsidian/module-modern-frontend-cli | Packagist |
| `packages/module-modern-frontend-twig` | mage-obsidian/module-modern-frontend-twig | Packagist |
| `packages/component-modern-frontend` | mage-obsidian/component-modern-frontend | Packagist |
| `packages/js-package-utils` | mage-obsidian/js-package-utils | npm (`mage-obsidian`) |

All packages share one version. Release with `bin/release X.Y.Z`.
