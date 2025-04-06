export default {
    tailwind: {
        theme: {
            extend: {},
        },
        plugins: [],
        content: [
            './**/*.{vue,js}',
            '../**/*.phtml',
            '../*/page_layout/override/base/*.xml',
        ],
    },
    ignoredTailwindConfigFromModules: [],
    ignoredCssFromModules: [
        'Vendor_ModuleNameA',
    ],
};
