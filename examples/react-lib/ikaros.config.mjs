import { defineConfig } from '@ikaros-cli/ikaros'

export default defineConfig(() => {
    return {
        // ── 库模式配置 ──────────────────────────────────────────
        library: {
            entry: 'src/index.jsx',
            name: 'IkarosReactLib',
            formats: ['es', 'umd'],
            fileName: 'ikaros-react-lib-example',
            externals: ['react', 'react-dom', /^react\//],
            globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
            },
        },
    }
})
