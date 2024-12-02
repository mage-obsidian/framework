<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * @license MIT License - See the LICENSE file in the root directory for details.
 * © 2024 Jeanmarcos Juarez
 */

namespace MageObsidian\ModernFrontendCli\Utils;

use Symfony\Component\Console\Style\SymfonyStyle;

class CustomSymfonyStyle extends SymfonyStyle
{
    public function info(string|array $message): void
    {
        $this->block(
            $message,
            '!',
            'fg=blue',
            ' ',
            false
        );
    }

    public function table(array $headers, array $rows, $title = null): void
    {
        $table = $this->createTable()
                      ->setHeaders($headers)
                      ->setRows($rows)
                      ->setStyle('borderless');

        if (!empty($title)) {
            $this->note($title);
        }
        $table->render();
        $this->newLine();
    }

    public function note(string|array $message)
    {
        $this->block(
            $message,
            null,
            'fg=blue',
            ' '
        );
    }
}
