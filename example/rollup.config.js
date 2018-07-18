import serve from 'rollup-plugin-serve'

export default [
    {
        input: './example.js',
        output: {
            name: 'MasterTabExample',
            file: 'dist/example.js',
            format: 'iife',
            interop: false,
            strict: false
        },
        plugins: [
            serve('')
        ]
    },
    {
        input: 'iframe.js',
        output: {
            name: 'iframeLoop',
            file: 'dist/iframe.js',
            format: 'iife',
            interop: false,
            strict: false
        }
    },
]
