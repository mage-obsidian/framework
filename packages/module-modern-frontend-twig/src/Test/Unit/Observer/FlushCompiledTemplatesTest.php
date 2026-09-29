<?php
/**
 * This file is part of the MageObsidian - ModernFrontend project.
 *
 * SPDX-FileCopyrightText: 2024 Jeanmarcos Juarez
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Observer;

use Magento\Framework\Event\Observer;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use MageObsidian\ModernFrontendTwig\Observer\FlushCompiledTemplates;
use PHPUnit\Framework\TestCase;

class FlushCompiledTemplatesTest extends TestCase
{
    public function testRemovesTheCompiledTemplates(): void
    {
        $compiledTemplateCache = $this->createMock(CompiledTemplateCache::class);
        $compiledTemplateCache->expects($this->once())->method('clear');

        (new FlushCompiledTemplates($compiledTemplateCache))->execute(new Observer());
    }
}
