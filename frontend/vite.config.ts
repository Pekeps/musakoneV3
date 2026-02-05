import preact from '@preact/preset-vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [UnoCSS(), preact()],
    resolve: {
        alias: {
            '@': '/src',
            react: 'preact/compat',
            'react-dom': 'preact/compat',
        },
    },
    build: {
        target: 'es2022',
        minify: 'terser',
        rollupOptions: {
            output: {
                manualChunks: undefined,
            },
        },
    },
    server: {
        port: 3000,
        host: true,
    },
});
