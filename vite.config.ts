import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        try {
          // Ensure dist directory exists
          const distDir = resolve(__dirname, 'dist');
          if (!existsSync(distDir)) {
            mkdirSync(distDir, { recursive: true });
          }

          // Copy manifest.json to dist
          const srcManifest = resolve(__dirname, 'manifest.json');
          const destManifest = resolve(__dirname, 'dist/manifest.json');
          
          if (existsSync(srcManifest)) {
            copyFileSync(srcManifest, destManifest);
            console.log('✓ Copied manifest.json to dist/');
          } else {
            console.error(`manifest.json not found at ${srcManifest}`);
          }

          // Copy icons folder
          const iconsDir = resolve(__dirname, 'icons');
          const distIconsDir = resolve(__dirname, 'dist/icons');

          if (existsSync(iconsDir)) {
            if (!existsSync(distIconsDir)) {
              mkdirSync(distIconsDir, { recursive: true });
            }

            // Copy all PNG icons
            const iconFiles = readdirSync(iconsDir).filter((f: string) => f.endsWith('.png'));

            iconFiles.forEach((file: string) => {
              copyFileSync(
                resolve(iconsDir, file),
                resolve(distIconsDir, file)
              );
            });

            console.log('✓ Copied manifest.json and icons to dist/');
          }

          // Copy fonts folder (GT America)
          const fontsDir = resolve(__dirname, 'fonts');
          const distFontsDir = resolve(__dirname, 'dist/fonts');

          if (existsSync(fontsDir)) {
            if (!existsSync(distFontsDir)) {
              mkdirSync(distFontsDir, { recursive: true });
            }

            // Recursively copy fonts directory
            const copyRecursive = (src: string, dest: string) => {
              if (!existsSync(dest)) {
                mkdirSync(dest, { recursive: true });
              }
              
              const entries = readdirSync(src, { withFileTypes: true });
              
              entries.forEach(entry => {
                const srcPath = resolve(src, entry.name);
                const destPath = resolve(dest, entry.name);
                
                if (entry.isDirectory()) {
                  copyRecursive(srcPath, destPath);
                } else {
                  copyFileSync(srcPath, destPath);
                }
              });
            };

            copyRecursive(fontsDir, distFontsDir);
            console.log('✓ Copied fonts to dist/');
          }
        } catch (error) {
          console.error('Error copying files:', error);
          throw error;
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        settings: resolve(__dirname, 'settings.html'),
        background: resolve(__dirname, 'background.ts'),
        content: resolve(__dirname, 'content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Content and background scripts should be standalone
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // Don't minify to avoid single-line issues with Chrome
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
