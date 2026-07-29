<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use LogicException;
use Magento\Framework\Filesystem\Driver\File;
use Magento\Framework\View\Asset\File as FileAsset;
use Magento\Framework\View\Asset\Repository;
use MageObsidian\ModernFrontendTwig\Model\Template\ViewFileInliner;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class ViewFileInlinerTest extends TestCase
{
    private const FILE_ID = 'Magento_Theme::css/view-transitions.css';
    private const SOURCE = '/var/www/app/design/frontend/Acme/default/web/css/view-transitions.css';
    private const CSS = '::view-transition-old(root) { animation: none; }';

    protected function setUp(): void
    {
        if (!interface_exists(Repository::class) && !class_exists(Repository::class)) {
            $this->markTestSkipped('Magento framework is not available in this runtime.');
        }
    }

    public function testReturnsTheResolvedFileContents(): void
    {
        $inliner = new ViewFileInliner(
            $this->repository($this->asset(self::SOURCE)),
            $this->driver([self::SOURCE => self::CSS])
        );

        $this->assertSame(self::CSS, $inliner->inline(self::FILE_ID));
    }

    public function testReadsTheFileOnceAcrossRepeatedCalls(): void
    {
        $driver = $this->createMock(File::class);
        $driver->expects($this->once())
            ->method('fileGetContents')
            ->with(self::SOURCE)
            ->willReturn(self::CSS);

        $inliner = new ViewFileInliner($this->repository($this->asset(self::SOURCE)), $driver);

        $this->assertSame(self::CSS, $inliner->inline(self::FILE_ID));
        $this->assertSame(self::CSS, $inliner->inline(self::FILE_ID));
    }

    public function testNamesTheHelperAndTheFileWhenItCannotBeRead(): void
    {
        $repository = $this->createMock(Repository::class);
        $repository->method('createAsset')->willThrowException(new RuntimeException('missing'));

        $inliner = new ViewFileInliner($repository, $this->createMock(File::class));

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('inline_view_file');
        $this->expectExceptionMessage(self::FILE_ID);

        $inliner->inline(self::FILE_ID);
    }

    private function asset(string $source): FileAsset
    {
        $asset = $this->createMock(FileAsset::class);
        $asset->method('getSourceFile')->willReturn($source);

        return $asset;
    }

    private function repository(FileAsset $asset): Repository
    {
        $repository = $this->createMock(Repository::class);
        $repository->method('createAsset')->willReturn($asset);

        return $repository;
    }

    /**
     * @param array<string, string> $files
     */
    private function driver(array $files): File
    {
        $driver = $this->createMock(File::class);
        $driver->method('fileGetContents')->willReturnCallback(
            static fn(string $path): string => $files[$path] ?? ''
        );

        return $driver;
    }
}
