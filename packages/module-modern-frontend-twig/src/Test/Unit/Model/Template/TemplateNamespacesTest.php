<?php
declare(strict_types=1);

namespace MageObsidian\ModernFrontendTwig\Test\Unit\Model\Template;

use Magento\Framework\Component\ComponentRegistrar;
use Magento\Framework\Component\ComponentRegistrarInterface;
use Magento\Framework\Module\ModuleListInterface;
use MageObsidian\ModernFrontendTwig\Model\Template\TemplateNamespaces;
use PHPUnit\Framework\TestCase;

/**
 * The table is derived, not declared, so what matters is that the derivation is
 * stable: a vendor-qualified alias never changes, and a short one is only handed
 * out while exactly one module can claim it.
 */
class TemplateNamespacesTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/mage-obsidian-namespaces-' . uniqid('', true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->root . '/*/view/*/templates') ?: [] as $directory) {
            @rmdir($directory);
            @rmdir(dirname($directory));
            @rmdir(dirname($directory, 2));
            @rmdir(dirname($directory, 3));
        }
        @rmdir($this->root);
    }

    /**
     * @param string[] $modules
     * @param array<string, string> $explicit
     * @param string[] $withTemplates Modules that ship a view templates directory.
     */
    private function namespaces(array $modules, array $explicit = [], array $withTemplates = []): TemplateNamespaces
    {
        $moduleList = $this->createMock(ModuleListInterface::class);
        $moduleList->method('getNames')->willReturn($modules);

        foreach ($withTemplates as $module) {
            @mkdir($this->root . '/' . $module . '/view/frontend/templates', 0o777, true);
        }

        $registrar = $this->createMock(ComponentRegistrarInterface::class);
        $registrar->method('getPath')->willReturnCallback(
            fn(string $type, string $name): ?string => $type === ComponentRegistrar::MODULE
                ? $this->root . '/' . $name
                : null
        );

        return new TemplateNamespaces($moduleList, $registrar, $explicit);
    }

    public function testEveryModuleGetsAVendorQualifiedAlias(): void
    {
        $table = $this->namespaces(['Magento_Catalog', 'MageObsidian_InventoryStockVisualizer'])->getAll();

        $this->assertSame('Magento_Catalog', $table['magento-catalog']);
        $this->assertSame(
            'MageObsidian_InventoryStockVisualizer',
            $table['mage-obsidian-inventory-stock-visualizer']
        );
    }

    public function testAShortAliasIsRegisteredWhenOnlyOneModuleClaimsIt(): void
    {
        $table = $this->namespaces(['Magento_Theme', 'Magento_Catalog'])->getAll();

        $this->assertSame('Magento_Theme', $table['theme']);
        $this->assertSame('Magento_Catalog', $table['catalog']);
    }

    public function testACollisionIsBrokenByWhichModuleShipsTemplates(): void
    {
        $namespaces = $this->namespaces(
            ['Magento_Catalog', 'MageObsidian_Catalog'],
            [],
            ['Magento_Catalog']
        );

        $this->assertSame('Magento_Catalog', $namespaces->getAll()['catalog']);
        $this->assertSame([], $namespaces->getAmbiguous());
    }

    public function testACollisionNeitherModuleCanBreakIsRegisteredForNeither(): void
    {
        $namespaces = $this->namespaces(['Magento_Catalog', 'MageObsidian_Catalog']);

        $this->assertArrayNotHasKey('catalog', $namespaces->getAll());
        $this->assertSame(
            ['catalog' => ['MageObsidian_Catalog', 'Magento_Catalog']],
            $namespaces->getAmbiguous()
        );
    }

    public function testACollisionBothModulesCanBreakIsRegisteredForNeither(): void
    {
        $namespaces = $this->namespaces(
            ['Magento_Catalog', 'MageObsidian_Catalog'],
            [],
            ['Magento_Catalog', 'MageObsidian_Catalog']
        );

        $this->assertArrayNotHasKey('catalog', $namespaces->getAll());
        $this->assertArrayHasKey('catalog', $namespaces->getAmbiguous());
    }

    public function testAnUncontestedAliasNeedsNoTemplatesOnDisk(): void
    {
        $this->assertSame('MageObsidian_Storefront', $this->namespaces(['MageObsidian_Storefront'])->getAll()['storefront']);
    }

    public function testAnExplicitAliasSettlesACollision(): void
    {
        $namespaces = $this->namespaces(
            ['Magento_Catalog', 'MageObsidian_Catalog'],
            ['catalog' => 'MageObsidian_Catalog']
        );

        $this->assertSame('MageObsidian_Catalog', $namespaces->getAll()['catalog']);
        $this->assertSame([], $namespaces->getAmbiguous());
    }

    public function testAnExplicitAliasOverridesADerivedOne(): void
    {
        $table = $this->namespaces(['Magento_Theme'], ['theme' => 'Vendor_Custom'])->getAll();

        $this->assertSame('Vendor_Custom', $table['theme']);
    }

    public function testAcronymsCollapseIntoASingleSegment(): void
    {
        $table = $this->namespaces(['Magento_CatalogUrlRewrite', 'Vendor_CatalogURLImport'])->getAll();

        $this->assertSame('Magento_CatalogUrlRewrite', $table['magento-catalog-url-rewrite']);
        $this->assertSame('Vendor_CatalogURLImport', $table['vendor-catalog-url-import']);
    }

    public function testExpandRewritesAnAliasIntoAModuleReference(): void
    {
        $namespaces = $this->namespaces(['Magento_Catalog']);

        $this->assertSame(
            'Magento_Catalog::product/form/configurable.twig',
            $namespaces->expand('@catalog/product/form/configurable.twig')
        );
    }

    public function testExpandIgnoresNamesThatAreNotAliasReferences(): void
    {
        $namespaces = $this->namespaces(['Magento_Catalog']);

        $this->assertNull($namespaces->expand('Magento_Catalog::product/card.twig'));
        $this->assertNull($namespaces->expand('@parent'));
        $this->assertNull($namespaces->expand('@unknown/product/card.twig'));
    }

    public function testSuggestOffersCloseAliases(): void
    {
        $namespaces = $this->namespaces(['Magento_Catalog', 'Magento_Theme']);

        $this->assertContains('@catalog', $namespaces->suggest('catalogs'));
    }

    public function testTheSignatureMovesWithTheTable(): void
    {
        $before = $this->namespaces(['Magento_Catalog'])->getSignature();
        $after = $this->namespaces(['Magento_Catalog'], ['shop' => 'Magento_Catalog'])->getSignature();

        $this->assertSame($before, $this->namespaces(['Magento_Catalog'])->getSignature());
        $this->assertNotSame($before, $after);
    }

    public function testMalformedModuleNamesAreSkipped(): void
    {
        $table = $this->namespaces(['NoUnderscore', 'Magento_Catalog', '_Leading'])->getAll();

        $this->assertSame(['catalog', 'magento-catalog'], array_keys($table));
    }
}
