/**
 * DataGrid 独立场景预览入口。
 * 与文档长页共享全局样式、场景注册表和真实演示组件。
 */

import 'element-plus/dist/index.css'
import { createApp } from 'vue'
import PreviewApp from './PreviewApp.vue'
import './styles/global.scss'

createApp(PreviewApp).mount('#app')
