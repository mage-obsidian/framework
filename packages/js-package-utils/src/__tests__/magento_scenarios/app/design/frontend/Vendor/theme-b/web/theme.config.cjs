module.exports = {
    tailwind: {
        theme: {
            extend: {
                textColor: {
                    'primary': '#3490dc',
                    'secondary': '#ffed4a',
                    'danger': '#e3342f',
                },
            },
        },
        plugins: [],
        content: [
            './**/*.{vue,js}',
            '../**/*.phtml',
            '../*/page_layout/override/base/*.xml',
        ],
    },
    ignoredCssFromModules: [
        'Vendor_ModuleNameNoConfig'
    ]
}
