/**
 * @hzb-ui/data-grid 组件库构建配置。
 * 输出 ESM、类型声明和独立样式文件，并保持宿主框架依赖外置。
 */

import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const externalPackages = [
  'vue',
  'element-plus',
  '@element-plus/icons-vue',
  'ag-grid-community',
  'ag-grid-vue3',
  'big.js',
  'dayjs',
  'lodash',
  'vuedraggable',
]

export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: false,
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.ts'],
      bundleTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: (id) =>
        !/\.css(?:\?|$)/.test(id) &&
        externalPackages.some(
          (packageName) => id === packageName || id.startsWith(`${packageName}/`),
        ),
    },
  },
})
