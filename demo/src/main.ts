/**
 * DataGrid 演示站应用入口。
 * 负责加载 Element Plus 样式、演示站全局样式并挂载根页面。
 */

import 'element-plus/dist/index.css'
import { createApp } from 'vue'
import App from './App.vue'
import './styles/global.scss'

createApp(App).mount('#app')
