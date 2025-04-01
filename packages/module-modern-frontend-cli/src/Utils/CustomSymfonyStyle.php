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
    /**
     * CustomSymfonyStyle constructor.
     *
     * @param string|array $message
     */
    public function info(string|array $message): void
    {
        $this->block($message, '!', 'fg=blue', ' ', false);
    }

    /**
     * CustomSymfonyStyle constructor.
     *
     * @param array $headers
     * @param array $rows
     * @param string|null $title
     */
    public function table(array $headers, array $rows, ?string $title = null): void
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

    /**
     * CustomSymfonyStyle constructor.
     *
     * @param string|array $message
     */
    public function note(string|array $message): void
    {
        $this->block($message, null, 'fg=blue', ' ');
    }
}
