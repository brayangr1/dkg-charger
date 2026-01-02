import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@screens': path.resolve(__dirname, './src/screens'),
            '@services': path.resolve(__dirname, './src/services'),
            '@context': path.resolve(__dirname, './src/context'),
            '@config': path.resolve(__dirname, './src/config'),
            '@utils': path.resolve(__dirname, './src/utils'),
            '@types': path.resolve(__dirname, './src/types'),
            '@constants': path.resolve(__dirname, './src/constants'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
        },
    },
    server: {
        port: 8081,
        proxy: {
            '/api': {
                target: 'http://localhost:5010',
                changeOrigin: true,
                secure: false,
            },
            '/ocpp': {
                target: 'https://server.dkgsolutions.es',
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
})
