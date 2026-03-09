import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(async ({ command }) => {
    const { needlePlugins, useGzip, loadConfig } = await import("@needle-tools/engine/plugins/vite/index.js");
    const needleConfig = await loadConfig();
    return {
        base: "./",
        plugins: [
            mkcert(),
            useGzip(needleConfig) ? viteCompression({ deleteOriginFile: true }) : null,
            needlePlugins(command, needleConfig, {
                noPoster: true,
                allowHotReload: false,
                buildPipeline: { enabled: false },
            }),
        ],
        server: {
            https: true,
            proxy: {
              'https://localhost:3000': 'https://localhost:3000',
            },
            strictPort: true,
            port: 3000,
            hmr: false,
        },
        build: {
            outDir: "./dist",
            emptyOutDir: true,
        }
    }
});
