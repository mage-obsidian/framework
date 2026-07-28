<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Cache;

use MageObsidian\ModernFrontendTwig\Model\Cache\BuildSignature;
use MageObsidian\ModernFrontendTwig\Model\Cache\PackageVersions;
use MageObsidian\ModernFrontendTwig\Model\Template\TemplateNamespaces;
use PHPUnit\Framework\TestCase;

/**
 * The signature is what keeps a deploy from reading templates compiled by the
 * previous one, so what matters is that it moves when — and only when — the
 * installed package set does.
 */
class BuildSignatureTest extends TestCase
{
    private function signature(array $rawData, string $aliases = 'aliases'): string
    {
        $packageVersions = $this->createMock(PackageVersions::class);
        $packageVersions->method('getAll')->willReturn($rawData);

        $namespaces = $this->createMock(TemplateNamespaces::class);
        $namespaces->method('getSignature')->willReturn($aliases);

        return (new BuildSignature($packageVersions, $namespaces))->get();
    }

    private function rawData(string $version, string $reference): array
    {
        return [
            [
                'versions' => [
                    'mage-obsidian/theme-base' => ['version' => $version, 'reference' => $reference],
                    'magento/framework' => ['version' => '103.0.8.0', 'reference' => 'aaa'],
                ],
            ],
        ];
    }

    public function testIsStableForTheSamePackageSet(): void
    {
        $this->assertSame(
            $this->signature($this->rawData('3.1.0.0', 'abc')),
            $this->signature($this->rawData('3.1.0.0', 'abc'))
        );
    }

    public function testChangesWhenAPackageVersionChanges(): void
    {
        $this->assertNotSame(
            $this->signature($this->rawData('3.1.0.0', 'abc')),
            $this->signature($this->rawData('3.2.0.0', 'abc'))
        );
    }

    public function testChangesWhenOnlyTheReferenceChanges(): void
    {
        $this->assertNotSame(
            $this->signature($this->rawData('3.1.0.0', 'abc')),
            $this->signature($this->rawData('3.1.0.0', 'def'))
        );
    }

    public function testIgnoresThePackageOrderReportedByComposer(): void
    {
        $ordered = [['versions' => [
            'a/one' => ['version' => '1.0.0.0', 'reference' => 'x'],
            'b/two' => ['version' => '2.0.0.0', 'reference' => 'y'],
        ]]];
        $shuffled = [['versions' => [
            'b/two' => ['version' => '2.0.0.0', 'reference' => 'y'],
            'a/one' => ['version' => '1.0.0.0', 'reference' => 'x'],
        ]]];

        $this->assertSame($this->signature($ordered), $this->signature($shuffled));
    }

    public function testChangesWhenTheNamespaceTableChanges(): void
    {
        $this->assertNotSame(
            $this->signature($this->rawData('3.1.0.0', 'abc'), 'before'),
            $this->signature($this->rawData('3.1.0.0', 'abc'), 'after')
        );
    }

    public function testUsableAsADirectoryName(): void
    {
        $this->assertMatchesRegularExpression('/^[a-z0-9]+$/', $this->signature($this->rawData('3.1.0.0', 'abc')));
        $this->assertMatchesRegularExpression('/^[a-z0-9-]+$/', $this->signature([]));
    }

    public function testFallsBackWhenComposerRuntimeDataIsUnavailable(): void
    {
        $this->assertStringStartsWith(BuildSignature::FALLBACK . '-', $this->signature([]));
    }

    public function testTheFallbackStillTracksTheNamespaceTable(): void
    {
        $this->assertNotSame($this->signature([], 'before'), $this->signature([], 'after'));
    }

    public function testMemoizesTheResult(): void
    {
        $packageVersions = $this->createMock(PackageVersions::class);
        $packageVersions->expects($this->once())
            ->method('getAll')
            ->willReturn($this->rawData('3.1.0.0', 'abc'));

        $buildSignature = new BuildSignature($packageVersions, $this->createMock(TemplateNamespaces::class));

        $this->assertSame($buildSignature->get(), $buildSignature->get());
    }
}
