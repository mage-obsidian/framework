module.exports = {
    tailwind: {
        theme: {
            extend: {
            },
        },
        plugins: [],
        content: [
            './**/*.{vue,js}',
            '../**/*.phtml',
            '../*/page_layout/override/base/*.xml',
        ],
    },
    includeTailwindConfigFromParentThemes: false,
    ignoredTailwindConfigFromModules: 'all'
}
