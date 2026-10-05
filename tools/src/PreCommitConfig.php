<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2026 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */

declare(strict_types=1);

namespace MageObsidian\Monorepo;

final class PreCommitConfig
{
    public const string EXCLUDE = '(^|/)(generated|\.precompiled|dist|node_modules|vendor|\.artifacts|playwright-report|__mocks__|fixtures)/|/web/critical/|__tests__/magento_scenarios/';

    private const array STYLES = [
        'PHP' => ['\.php$', '/**| *| */', '^<\?php$'],
        'PHTML' => ['\.phtml$', '<?php /**| *| */ ?>', null],
        'Twig' => ['\.twig$', '{#||#}', null],
        'Vue and HTML' => ['\.(vue|html)$', '<!--||-->', null],
        'XML' => ['\.xml$', '<!--||-->', '^<\?xml.*\?>$'],
        'TypeScript and JavaScript' => ['\.(ts|js|mjs)$', '//', null],
        'CSS' => ['\.css$', '/*| *| */', null],
    ];

    public static function render(array $scopes, array $packageExcludes = []): string
    {
        $exclude = self::EXCLUDE;
        foreach ($packageExcludes as $package => $pattern) {
            $exclude .= sprintf('|^packages/%s/%s', $package, $pattern);
        }

        $lines = [
            sprintf("exclude: '%s'", $exclude),
            'repos:',
            '  - repo: https://github.com/Lucas-C/pre-commit-hooks',
            '    rev: v1.5.6',
            '    hooks:',
        ];

        foreach ($scopes as $prefix => $header) {
            foreach (self::STYLES as $label => [$files, $commentStyle, $afterRegex]) {
                $args = [
                    '--license-filepath',
                    $header,
                    '--no-extra-eol',
                    '--allow-past-years',
                    '--detect-license-in-X-top-lines',
                    "'16'",
                    '--comment-style',
                    sprintf("'%s'", $commentStyle),
                ];
                if ($afterRegex !== null) {
                    array_push($args, '--insert-license-after-regex', sprintf("'%s'", $afterRegex));
                }
                array_push(
                    $lines,
                    '      - id: insert-license',
                    sprintf('        name: SPDX header (%s) %s', $label, rtrim($prefix, '/')),
                    sprintf("        files: '^%s.*%s'", $prefix, $files),
                    sprintf('        args: [%s]', implode(', ', $args)),
                );
            }
        }

        return implode("\n", $lines) . "\n";
    }
}
