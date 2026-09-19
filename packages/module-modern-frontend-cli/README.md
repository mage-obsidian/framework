# MageObsidian — CLI

[![Latest Version](https://img.shields.io/packagist/v/mage-obsidian/module-modern-frontend-cli.svg?style=flat-square)](https://packagist.org/packages/mage-obsidian/module-modern-frontend-cli)
[![CI](https://github.com/mage-obsidian/module-modern-frontend-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mage-obsidian/module-modern-frontend-cli/actions/workflows/ci.yml)
[![License](https://img.shields.io/packagist/l/mage-obsidian/module-modern-frontend-cli.svg?style=flat-square)](https://packagist.org/packages/mage-obsidian/module-modern-frontend-cli)

[![Star MageObsidian](https://img.shields.io/github/stars/mage-obsidian/module-modern-frontend?style=flat-square&label=Star%20the%20core%20repo&logo=github)](https://github.com/mage-obsidian/module-modern-frontend)

📚 [Documentation](https://mage-obsidian.jeanmarcos.dev/) · 🚀 [Live demo](https://mage-obsidian-demo.jeanmarcos.dev/) · 💬 [Discussions](https://github.com/mage-obsidian/module-modern-frontend/discussions)

`bin/magento` console commands for [MageObsidian](https://github.com/mage-obsidian/module-modern-frontend), a modern frontend for Magento 2.

## Commands

```bash
bin/magento mage-obsidian:frontend:config --generate      # write the PHP↔JS config contract
bin/magento mage-obsidian:frontend:config --show [--modules|--themes]
bin/magento mage-obsidian:frontend:hmr --enable|--disable|--show
bin/magento mage-obsidian:i18n:collect [--locale en_US]   # collect phrases into each component i18n CSV
```

`mage-obsidian:i18n:collect` reads `.vue`/`.ts`/`.js` and `.twig` sources. Twig
extraction needs no Twig engine, but it does need the framework release that
ships `MageObsidian\ModernFrontend\Service\I18n\TwigPhraseExtractor` — the
first `mage-obsidian/module-modern-frontend` release after 2.19.0. The command
resolves that class through DI, so an older framework makes it fail on
construction rather than degrade: raise the `composer.json` constraint to that
release when it is published.

`mage-obsidian:frontend:doctor`'s Adobe Commerce section needs the framework
release that ships `MageObsidian\ModernFrontend\Service\Dev\AdobeCommerceInventory`
— the first `mage-obsidian/module-modern-frontend` release after 2.19.0. The
command resolves that class through DI, so an older framework makes it fail
on construction rather than degrade: raise the `composer.json` constraint to
that release when it is published.

## Installation

Installed automatically with the [Vite harness](https://github.com/mage-obsidian/component-modern-frontend):

```bash
composer require mage-obsidian/component-modern-frontend
```

## Support the project

If MageObsidian saves you time, consider [buying me a coffee](https://ko-fi.com/Q5Q816Z9WN). ❤️
