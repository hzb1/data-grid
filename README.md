# @hzb-ui/data-grid

基于 Vue 3、AG Grid Community 和 Element Plus 的业务数据网格组件库。

Element Plus 作为 peer dependency 保留，用于筛选器、编辑器、弹窗、表单上下文和消息反馈；
DataGrid 自身不会要求宿主执行全量 `app.use(ElementPlus)`，但宿主需要提供 Element Plus 样式。

## 安装

```bash
npm install @hzb-ui/data-grid vue element-plus ag-grid-community ag-grid-vue3
```

## 使用

```ts
import { DataGrid } from '@hzb-ui/data-grid'
import '@hzb-ui/data-grid/style.css'
import 'element-plus/dist/index.css'
```

本包仅发布 ESM，AG Grid Community 的基础模块由 DataGrid 内部注册。Vue、Element Plus、
AG Grid Community 和 AG Grid Vue 由宿主项目安装，避免组件库重复打包框架依赖。

需要用户级列配置隔离时，在应用入口安装插件：

```ts
import { DataGridPlugin } from '@hzb-ui/data-grid'

app.use(DataGridPlugin, {
  resolvePersistenceScope: () => ({
    tenantId: currentTenantId,
    userId: currentUserId,
  }),
})
```

## 工程命令

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run check:runtime
npm run check:package
```

开发环境使用 Node.js 24（见 `.nvmrc`），最低支持 Node.js 22.12。CI 会执行完整的
`npm run check`，Dependabot 定期检查 npm 与 GitHub Actions 更新。
