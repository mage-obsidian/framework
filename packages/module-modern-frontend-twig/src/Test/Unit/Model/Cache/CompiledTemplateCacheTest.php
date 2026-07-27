<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Cache;

use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\Exception\FileSystemException;
use Magento\Framework\Filesystem;
use Magento\Framework\Filesystem\Directory\WriteInterface;
use MageObsidian\ModernFrontendTwig\Model\Cache\BuildSignature;
use MageObsidian\ModernFrontendTwig\Model\Cache\CacheTypeState;
use MageObsidian\ModernFrontendTwig\Model\Cache\CompiledTemplateCache;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/**
 * Covers the two guarantees the rest of the engine relies on: a build never
 * reads another build's compiled templates, and cleaning the cache type really
 * removes them from disk.
 */
class CompiledTemplateCacheTest extends TestCase
{
    private const SIGNATURE = 'sig1';
    private const CURRENT = CompiledTemplateCache::BASE_PATH . '/' . self::SIGNATURE;

    private WriteInterface&MockObject $varDirectory;
    private CacheTypeState&MockObject $cacheTypeState;

    protected function setUp(): void
    {
        $this->varDirectory = $this->createMock(WriteInterface::class);
        $this->varDirectory->method('getAbsolutePath')
            ->willReturnCallback(static fn(string $path): string => '/var/www/var/' . $path);
        $this->cacheTypeState = $this->createMock(CacheTypeState::class);
        $this->cacheTypeState->method('isCompilationCacheEnabled')->willReturn(true);
    }

    private function cache(): CompiledTemplateCache
    {
        $filesystem = $this->createMock(Filesystem::class);
        $filesystem->method('getDirectoryWrite')
            ->with(DirectoryList::VAR_DIR)
            ->willReturn($this->varDirectory);

        $buildSignature = $this->createMock(BuildSignature::class);
        $buildSignature->method('get')->willReturn(self::SIGNATURE);

        return new CompiledTemplateCache($filesystem, $buildSignature, $this->cacheTypeState);
    }

    public function testScopesTheDirectoryToTheCurrentBuild(): void
    {
        $this->varDirectory->method('isExist')->willReturn(true);

        $this->assertSame('/var/www/var/' . self::CURRENT, $this->cache()->getDirectory());
    }

    public function testDisablingTheCacheTypeTurnsCompilationCachingOff(): void
    {
        $this->cacheTypeState = $this->createMock(CacheTypeState::class);
        $this->cacheTypeState->method('isCompilationCacheEnabled')->willReturn(false);

        $this->varDirectory->expects($this->never())->method('create');

        $this->assertFalse($this->cache()->getDirectory());
    }

    public function testCreatesTheBuildDirectoryAndDropsTheOtherBuilds(): void
    {
        $stale = CompiledTemplateCache::BASE_PATH . '/sig0';

        $this->varDirectory->method('isExist')
            ->willReturnMap([
                [self::CURRENT, false],
                [CompiledTemplateCache::BASE_PATH, true],
            ]);
        $this->varDirectory->method('search')
            ->with('*', CompiledTemplateCache::BASE_PATH)
            ->willReturn([$stale . '/', self::CURRENT . '/']);
        $this->varDirectory->expects($this->once())->method('delete')->with($stale);
        $this->varDirectory->expects($this->once())->method('create')->with(self::CURRENT);

        $this->cache()->getDirectory();
    }

    public function testKeepsRenderingWhenAnOldBuildCannotBeRemoved(): void
    {
        $this->varDirectory->method('isExist')
            ->willReturnMap([
                [self::CURRENT, false],
                [CompiledTemplateCache::BASE_PATH, true],
            ]);
        $this->varDirectory->method('search')->willReturn([CompiledTemplateCache::BASE_PATH . '/sig0']);
        $this->varDirectory->method('delete')->willThrowException(new FileSystemException(__('denied')));
        $this->varDirectory->expects($this->once())->method('create')->with(self::CURRENT);

        $this->cache()->getDirectory();
    }

    public function testClearRemovesEveryBuild(): void
    {
        $this->varDirectory->method('isExist')->with(CompiledTemplateCache::BASE_PATH)->willReturn(true);
        $this->varDirectory->expects($this->once())
            ->method('delete')
            ->with(CompiledTemplateCache::BASE_PATH);

        $this->cache()->clear();
    }

    public function testClearIsANoopWhenNothingWasCompiledYet(): void
    {
        $this->varDirectory->method('isExist')->willReturn(false);
        $this->varDirectory->expects($this->never())->method('delete');

        $this->cache()->clear();
    }

    public function testClearReportsAFailureInsteadOfPretendingItWorked(): void
    {
        $this->varDirectory->method('isExist')->willReturn(true);
        $this->varDirectory->method('delete')->willThrowException(new FileSystemException(__('denied')));

        $this->expectException(FileSystemException::class);

        $this->cache()->clear();
    }
}
