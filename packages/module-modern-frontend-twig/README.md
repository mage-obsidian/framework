# MageObsidian ModernFrontend — Twig engine (optional)

Optional add-on for [`mage-obsidian/module-modern-frontend`](https://packagist.org/packages/mage-obsidian/module-modern-frontend).
Installing this module registers a **`.twig` template engine alongside Magento's native `.phtml`**;
removing it leaves only `.phtml`. Nothing else opts in — the engine is enabled by the module's presence.

## How it works

Magento dispatches a block's template by file extension
(`Magento\Framework\View\Element\Template::fetchView` → `TemplateEnginePool`). This module adds a
`twig` entry to that engine map, so a block whose `template` ends in `.twig` is rendered by Twig while
every `.phtml` keeps using the PHP engine. `.twig` and `.phtml` coexist in the same theme, and the
theme fallback resolves `.twig` overrides exactly like `.phtml`.

## What you get over phtml

- **HTML auto-escaping on by default** — the main security gain; opt out per value with Twig's `raw`.
- **Twig inheritance** (`{% extends %}` / `{% block %}`) and includes, resolved through the Magento
  theme fallback (use `Vendor_Module::path.twig` names).
- **The MageObsidian bridge**, so a `.twig` mounts Vue islands like a `.phtml`:
  - `{{ render_vue('Vendor_Module::Component', { prop: value }) }}`
  - `{{ child_html('alias') }}`, `{{ hero_icon('check', 'solid', '24') }}`
  - `{{ vite_url(path) }}`, `{{ component_path(name) }}`, `{{ view_file_url(fileId) }}`
  - filters mirroring `$escaper`: `|escape_url`, `|escape_html_attr`, `|escape_js`, `|escape_css`
- Block data via `{{ block.getX() }}` / `{{ block.getData('x') }}`.

Compiled templates are cached under `var/cache/twig`. In developer mode templates auto-reload on
change and `strict_variables` / `debug` are enabled.

> Note: this engine improves **server-template ergonomics**. It does not change runtime/browser
> performance — that is governed by the Vue/Vite/Tailwind output.

## Documentation

For more details, visit the [official documentation](https://mage-obsidian.jeanmarcos.dev/).
