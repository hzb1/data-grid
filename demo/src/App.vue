<script setup lang="ts">
/**
 * 页面名称：DataGrid 渐进式演示站
 * 页面 URL：/
 * 业务描述：通过文档式长页渐进展示 DataGrid 的基础展示、筛选选择和编辑校验能力。
 */

import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { demoNavGroups, demoRegistry } from './demo-registry'
import DemoScene from './components/DemoScene.vue'
import LazyDemo from './components/LazyDemo.vue'
import LiquidGlass from './components/LiquidGlass.vue'

/**
 * 安装命令复制操作的即时反馈状态。
 *
 * - `idle`：尚未复制或反馈已经结束。
 * - `success`：安装命令已经成功写入剪贴板。
 * - `error`：浏览器拒绝写入剪贴板或复制失败。
 */
type InstallCopyState = 'idle' | 'success' | 'error'

const activeSectionId = ref('when-to-use')
const mobileMenuOpen = ref(false)
const pageScrolled = ref(false)
const demoProgress = ref(0)
const installCopyState = ref<InstallCopyState>('idle')
const focusedSectionId = ref('')
const topbarRef = ref<HTMLElement | null>(null)
const mobileTriggerRef = ref<HTMLButtonElement | null>(null)
const activeNavLabel = computed(
  () =>
    demoNavGroups.flatMap((group) => group.items).find((item) => item.id === activeSectionId.value)
      ?.label ?? '目录',
)
let sectionObserver: IntersectionObserver | null = null
let scrollFrameId = 0
let focusTimerId = 0
let installCopyTimerId = 0

async function closeMobileMenu(restoreFocus = false) {
  if (!mobileMenuOpen.value) {
    return
  }

  mobileMenuOpen.value = false
  if (restoreFocus) {
    await nextTick()
    mobileTriggerRef.value?.focus()
  }
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

async function navigateTo(id: string) {
  const target = document.getElementById(id)
  if (!target) {
    return
  }

  const wasMobileMenuOpen = mobileMenuOpen.value
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeSectionId.value = id
  focusedSectionId.value = id
  window.clearTimeout(focusTimerId)
  focusTimerId = window.setTimeout(() => {
    focusedSectionId.value = ''
  }, 900)
  await closeMobileMenu(wasMobileMenuOpen)
  if (!wasMobileMenuOpen) {
    target.focus({ preventScroll: true })
  }
  window.history.replaceState(null, '', `#${id}`)
}

async function copyInstallCommand() {
  window.clearTimeout(installCopyTimerId)
  try {
    await window.navigator.clipboard.writeText('npm install @hzb-ui/data-grid')
    installCopyState.value = 'success'
  } catch {
    installCopyState.value = 'error'
  }
  installCopyTimerId = window.setTimeout(() => {
    installCopyState.value = 'idle'
  }, 1600)
}

function updateScrollFeedback() {
  pageScrolled.value = window.scrollY > 80
  if (window.innerWidth >= 1200 && mobileMenuOpen.value) {
    void closeMobileMenu(false)
  }

  const firstDemo = document.getElementById(demoRegistry[0]?.id ?? '')
  const lastDemo = document.getElementById(demoRegistry.at(-1)?.id ?? '')
  if (!firstDemo || !lastDemo) {
    return
  }

  const progressStart = firstDemo.offsetTop - window.innerHeight * 0.32
  const progressEnd = lastDemo.offsetTop + lastDemo.offsetHeight - window.innerHeight * 0.45
  const progressRange = Math.max(progressEnd - progressStart, 1)
  demoProgress.value = Math.min(Math.max((window.scrollY - progressStart) / progressRange, 0), 1)
}

function onWindowScroll() {
  if (scrollFrameId) {
    return
  }

  scrollFrameId = window.requestAnimationFrame(() => {
    updateScrollFeedback()
    scrollFrameId = 0
  })
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!mobileMenuOpen.value || topbarRef.value?.contains(event.target as Node)) {
    return
  }

  void closeMobileMenu(false)
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileMenuOpen.value) {
    event.preventDefault()
    void closeMobileMenu(true)
  }
}

onMounted(() => {
  const sections = document.querySelectorAll<HTMLElement>('[data-demo-section]')
  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

      if (visibleEntry?.target.id) {
        activeSectionId.value = visibleEntry.target.id
      }
    },
    {
      rootMargin: '-18% 0px -68% 0px',
      threshold: [0, 0.2, 0.6],
    },
  )
  sections.forEach((section) => sectionObserver?.observe(section))

  updateScrollFeedback()
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  window.addEventListener('resize', onWindowScroll, { passive: true })
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)

  const hashId = window.location.hash.slice(1)
  if (hashId && document.getElementById(hashId)) {
    window.setTimeout(() => navigateTo(hashId), 0)
  }
})

onUnmounted(() => {
  sectionObserver?.disconnect()
  window.removeEventListener('scroll', onWindowScroll)
  window.removeEventListener('resize', onWindowScroll)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.cancelAnimationFrame(scrollFrameId)
  window.clearTimeout(focusTimerId)
  window.clearTimeout(installCopyTimerId)
})
</script>

<template>
  <div class="demo-page">
    <div class="demo-page__glow demo-page__glow--blue" aria-hidden="true" />
    <div class="demo-page__glow demo-page__glow--violet" aria-hidden="true" />

    <header ref="topbarRef" class="demo-page__topbar" :class="{ 'is-compact': pageScrolled }">
      <!-- 液态玻璃顶部导航 -->
      <LiquidGlass as="nav" aria-label="DataGrid 演示站主导航" class="demo-page__nav">
        <div class="demo-page__brand" @click="navigateTo('when-to-use')">
          <span class="demo-page__brand-mark" aria-hidden="true">DG</span>
          <span>DataGrid</span>
        </div>

        <div class="demo-page__nav-actions">
          <button type="button" @click="navigateTo('basic')">演示</button>
          <a href="https://github.com/hzb1/data-grid" target="_blank" rel="noreferrer">GitHub</a>
          <span class="demo-page__version">v0.1.0</span>
          <button
            ref="mobileTriggerRef"
            class="demo-page__mobile-trigger"
            type="button"
            :aria-expanded="mobileMenuOpen"
            aria-controls="mobile-demo-menu"
            @click="toggleMobileMenu"
          >
            目录 · {{ activeNavLabel }}
          </button>
        </div>
      </LiquidGlass>

      <Transition name="demo-page-menu">
        <!-- 液态玻璃移动端目录 -->
        <LiquidGlass
          v-if="mobileMenuOpen"
          id="mobile-demo-menu"
          class="demo-page__mobile-menu"
          :svg-filter-enabled="false"
        >
          <div v-for="group in demoNavGroups" :key="group.label" class="demo-page__mobile-group">
            <strong>{{ group.label }}</strong>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              :class="{ 'is-active': activeSectionId === item.id }"
              @click="navigateTo(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </LiquidGlass>
      </Transition>
    </header>

    <main class="demo-page__main">
      <section
        id="when-to-use"
        class="demo-page__hero"
        :class="{ 'is-focused': focusedSectionId === 'when-to-use' }"
        data-demo-section
        tabindex="-1"
      >
        <p class="demo-page__eyebrow">Vue 3 · TypeScript · AG Grid Community</p>
        <h1>让复杂数据录入，<br /><span>保持清晰与可靠。</span></h1>
        <p class="demo-page__lead">
          DataGrid 面向高密度业务数据，把展示、筛选、编辑、校验和批量操作收进一条可控的数据链路。
        </p>
        <div class="demo-page__hero-actions">
          <button type="button" @click="navigateTo('basic')">浏览代码演示</button>
          <a href="https://github.com/hzb1/data-grid#readme" target="_blank" rel="noreferrer">
            阅读文档
          </a>
        </div>
        <div class="demo-page__capabilities" aria-label="DataGrid 主要能力">
          <span>受控数据</span>
          <span>类型安全列</span>
          <span>Excel 式交互</span>
          <span>业务校验</span>
        </div>
      </section>

      <section
        id="quick-start"
        class="demo-page__intro"
        :class="{ 'is-focused': focusedSectionId === 'quick-start' }"
        data-demo-section
        tabindex="-1"
      >
        <div>
          <p class="demo-page__section-index">01 / 开始</p>
          <h2>只描述业务列，其余交给表格</h2>
          <p>适合需要呈现大量结构化数据，同时又包含排序、筛选、编辑、校验和批量录入的业务页面。</p>
        </div>
        <div class="demo-page__install">
          <span>安装</span>
          <code>npm install @hzb-ui/data-grid</code>
          <button type="button" aria-label="复制安装命令" @click="copyInstallCommand">
            {{
              installCopyState === 'success'
                ? '已复制'
                : installCopyState === 'error'
                  ? '复制失败'
                  : '复制'
            }}
          </button>
          <span class="demo-page__live" aria-live="polite">
            {{
              installCopyState === 'success'
                ? '安装命令已复制'
                : installCopyState === 'error'
                  ? '安装命令复制失败'
                  : ''
            }}
          </span>
        </div>
      </section>

      <div class="demo-page__layout">
        <article class="demo-page__content">
          <header class="demo-page__section-head">
            <p class="demo-page__section-index">02 / 代码演示</p>
            <h2>从简单开始，逐步增加能力</h2>
            <p>每个示例只增加一组职责。代码默认收起，页面始终把可交互表格放在第一位。</p>
          </header>

          <section
            v-for="scene in demoRegistry"
            :id="scene.id"
            :key="scene.id"
            class="demo-page__demo"
            :class="{ 'is-focused': focusedSectionId === scene.id }"
            data-demo-section
            tabindex="-1"
          >
            <!-- 演示场景懒挂载容器 -->
            <LazyDemo :eager="scene.eager" :min-height="scene.minHeight">
              <!-- 注册表驱动的 DataGrid 演示场景 -->
              <DemoScene :scene="scene" />
            </LazyDemo>
          </section>
        </article>

        <aside class="demo-page__aside">
          <!-- 液态玻璃演示目录 -->
          <LiquidGlass as="nav" aria-label="当前页面目录" :svg-filter-enabled="false">
            <div class="demo-page__toc">
              <div class="demo-page__progress" aria-hidden="true">
                <span :style="{ transform: `scaleY(${demoProgress})` }" />
              </div>
              <div v-for="group in demoNavGroups" :key="group.label" class="demo-page__toc-group">
                <strong>{{ group.label }}</strong>
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="demo-page__toc-link"
                  :class="{ 'is-active': activeSectionId === item.id }"
                  @click="navigateTo(item.id)"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </LiquidGlass>
        </aside>
      </div>
    </main>

    <footer class="demo-page__footer">
      <span>DataGrid · 为真实业务数据而设计</span>
      <a href="#when-to-use" @click.prevent="navigateTo('when-to-use')">返回顶部 ↑</a>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.demo-page {
  position: relative;
  min-height: 100vh;
  overflow: clip;
  color: var(--demo-text);
  background: linear-gradient(180deg, #f9fbff 0, #fff 760px, var(--demo-page) 1180px);

  .demo-page__glow {
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    opacity: 0.36;
    filter: blur(5px);
    pointer-events: none;
  }

  .demo-page__glow--blue {
    top: -210px;
    left: -170px;
    background: radial-gradient(circle, #b9d6ff 0, rgb(212 231 255 / 0%) 68%);
  }

  .demo-page__glow--violet {
    top: -250px;
    right: -130px;
    background: radial-gradient(circle, #d9c9ff 0, rgb(229 219 255 / 0%) 68%);
  }

  .demo-page__topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: min(1380px, calc(100% - 64px));
    margin: 0 auto;
    padding-top: 18px;
    transition: padding var(--demo-motion-normal) var(--demo-ease-out);

    &.is-compact {
      padding-top: 9px;

      .demo-page__nav {
        min-height: 50px;
        border-color: rgb(255 255 255 / 82%);
        border-radius: 15px;
        background:
          linear-gradient(132deg, rgb(255 255 255 / 88%), rgb(255 255 255 / 72%)),
          rgb(239 245 255 / 52%);
        box-shadow:
          0 1px 0 rgb(255 255 255 / 88%) inset,
          0 10px 30px rgb(36 57 92 / 9%);
      }
    }
  }

  .demo-page__nav {
    width: 100%;
    min-height: 58px;
    border-radius: 18px;
    transition:
      min-height var(--demo-motion-normal) var(--demo-ease-out),
      border-radius var(--demo-motion-normal) var(--demo-ease-out),
      box-shadow var(--demo-motion-normal) var(--demo-ease-out);

    :deep(.liquid-glass__content) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
    }
  }

  .demo-page__brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 720;
    letter-spacing: -0.02em;
    cursor: pointer;
  }

  .demo-page__brand-mark {
    display: inline-flex;
    width: 30px;
    height: 30px;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: #fff;
    font-size: 11px;
    letter-spacing: 0;
    background: linear-gradient(145deg, #4679e2, #2855b9);
    box-shadow: 0 6px 16px rgb(45 91 186 / 24%);
  }

  .demo-page__nav-actions {
    display: flex;
    align-items: center;
    gap: 22px;

    button,
    a {
      border: 0;
      color: #4c596e;
      font-size: 13px;
      text-decoration: none;
      background: transparent;
      cursor: pointer;
      transition: color var(--demo-motion-fast) ease;

      &:hover {
        color: var(--demo-brand);
      }
    }
  }

  .demo-page__version {
    padding: 4px 8px;
    border: 1px solid rgb(185 200 228 / 60%);
    border-radius: 999px;
    color: #67758d;
    font-size: 11px;
    background: rgb(255 255 255 / 42%);
  }

  .demo-page__mobile-trigger {
    display: none;
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .demo-page__mobile-menu {
    display: none;
  }

  .demo-page__main {
    position: relative;
    z-index: 1;
    width: min(1380px, calc(100% - 64px));
    margin: 0 auto;
  }

  .demo-page__hero {
    padding: 114px 0 118px;
    scroll-margin-top: var(--demo-anchor-offset);

    &:focus {
      outline: none;
    }

    &.is-focused {
      animation: demo-page-focus-ring 900ms var(--demo-ease-out);
    }

    h1 {
      max-width: 780px;
      margin: 18px 0 24px;
      font-size: clamp(48px, 6vw, 76px);
      line-height: 1.08;
      letter-spacing: -0.055em;

      span {
        color: #315fae;
      }
    }
  }

  .demo-page__eyebrow,
  .demo-page__section-index {
    margin: 0;
    color: #5b74a3;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .demo-page__lead {
    max-width: 680px;
    margin: 0;
    color: var(--demo-muted);
    font-size: 18px;
    line-height: 1.85;
  }

  .demo-page__hero-actions {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: 34px;

    button,
    a {
      padding: 11px 18px;
      border: 1px solid #d4deee;
      border-radius: 10px;
      color: #42516a;
      font-size: 14px;
      text-decoration: none;
      background: rgb(255 255 255 / 66%);
      cursor: pointer;
      transition:
        border-color var(--demo-motion-fast) ease,
        background-color var(--demo-motion-fast) ease,
        box-shadow var(--demo-motion-fast) ease;

      &:hover {
        border-color: #bdcbe0;
        background: rgb(255 255 255 / 88%);
      }
    }

    button {
      border-color: #3568d4;
      color: #fff;
      background: #3568d4;
      box-shadow: 0 10px 22px rgb(53 104 212 / 20%);

      &:hover {
        border-color: #2f60c5;
        background: #2f60c5;
        box-shadow: 0 12px 26px rgb(53 104 212 / 24%);
      }
    }
  }

  .demo-page__capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 52px;

    span {
      padding: 7px 11px;
      border: 1px solid rgb(214 223 237 / 64%);
      border-radius: var(--demo-radius-pill);
      color: #65738b;
      font-size: 12px;
      background: rgb(255 255 255 / 44%);
    }
  }

  .demo-page__intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 0.7fr);
    align-items: end;
    gap: 70px;
    padding: 66px 0 80px;
    border-top: 1px solid var(--demo-border-soft);
    scroll-margin-top: var(--demo-anchor-offset);

    &:focus {
      outline: none;
    }

    &.is-focused {
      animation: demo-page-focus-ring 900ms var(--demo-ease-out);
    }

    h2 {
      margin: 14px 0 14px;
      font-size: 32px;
      letter-spacing: -0.035em;
    }

    p:not(.demo-page__section-index) {
      max-width: 690px;
      margin: 0;
      color: var(--demo-muted);
      line-height: 1.85;
    }
  }

  .demo-page__install {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 15px 16px;
    border: 1px solid var(--demo-border);
    border-radius: var(--demo-radius-md);
    background: var(--demo-surface-soft);
    box-shadow: 0 1px 1px rgb(31 47 75 / 2%);

    span {
      color: #7a8698;
      font-size: 12px;
    }

    code {
      overflow: hidden;
      color: #33435d;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    button {
      padding: 4px;
      border: 0;
      color: var(--demo-brand);
      font-size: 12px;
      background: transparent;
      cursor: pointer;
    }
  }

  .demo-page__live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .demo-page__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 188px;
    align-items: start;
    gap: 46px;
    padding-bottom: 120px;
  }

  .demo-page__content {
    min-width: 0;
  }

  .demo-page__section-head {
    padding: 58px 0 32px;
    border-top: 1px solid var(--demo-border-soft);

    h2 {
      margin: 14px 0 12px;
      font-size: 32px;
      letter-spacing: -0.035em;
    }

    p:last-child {
      margin: 0;
      color: var(--demo-muted);
      line-height: 1.8;
    }
  }

  .demo-page__demo {
    padding-top: 32px;
    scroll-margin-top: var(--demo-anchor-offset);

    &:focus {
      outline: none;
    }

    &.is-focused {
      animation: demo-page-focus-ring 900ms var(--demo-ease-out);
    }

    & + .demo-page__demo {
      padding-top: 54px;
    }
  }

  .demo-page__aside {
    position: sticky;
    top: 96px;
    padding-top: 58px;
  }

  .demo-page__toc {
    position: relative;
    padding: 20px 13px;
  }

  .demo-page__progress {
    position: absolute;
    top: 22px;
    bottom: 22px;
    left: 8px;
    width: 2px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(169 183 207 / 24%);

    span {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(180deg, #6e93dd, #7e6ed4);
      transform-origin: top;
      transition: transform var(--demo-motion-fast) linear;
    }
  }

  .demo-page__toc-group {
    display: flex;
    flex-direction: column;
    gap: 3px;

    & + .demo-page__toc-group {
      margin-top: 20px;
    }

    strong {
      padding: 0 10px 7px;
      color: #98a1b1;
      font-size: 11px;
      letter-spacing: 0.08em;
    }
  }

  .demo-page__toc-link {
    position: relative;
    padding: 8px 10px 8px 13px;
    border: 0;
    border-radius: var(--demo-radius-sm);
    color: #667287;
    font-size: 13px;
    text-align: left;
    background: transparent;
    cursor: pointer;
    transition:
      color var(--demo-motion-fast) ease,
      background-color var(--demo-motion-fast) ease;

    &::before {
      position: absolute;
      top: 8px;
      bottom: 8px;
      left: 0;
      width: 2px;
      border-radius: 2px;
      background: transparent;
      content: '';
    }

    &:hover,
    &.is-active {
      color: var(--demo-brand);
      background: rgb(237 243 255 / 52%);
    }

    &.is-active::before {
      background: var(--demo-brand);
    }
  }

  .demo-page-menu-enter-active,
  .demo-page-menu-leave-active {
    transition:
      opacity var(--demo-motion-fast) var(--demo-ease-out),
      transform var(--demo-motion-fast) var(--demo-ease-out);
  }

  .demo-page-menu-enter-from,
  .demo-page-menu-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }

  .demo-page__footer {
    position: relative;
    z-index: 1;
    display: flex;
    width: min(1380px, calc(100% - 64px));
    min-height: 88px;
    align-items: center;
    justify-content: space-between;
    margin: 0 auto;
    border-top: 1px solid var(--demo-border-soft);
    color: #788498;
    font-size: 13px;

    a {
      color: #536883;
      text-decoration: none;
    }
  }
}

@keyframes demo-page-focus-ring {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(53 104 212 / 0%);
  }

  35% {
    box-shadow: var(--demo-focus-ring);
  }
}

@media (max-width: 1199px) {
  .demo-page {
    .demo-page__layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .demo-page__aside {
      display: none;
    }

    .demo-page__mobile-trigger {
      display: inline-flex;
    }

    .demo-page__mobile-menu {
      position: absolute;
      top: 86px;
      right: 30px;
      display: block;
      width: 230px;
      padding: 14px;
      border-radius: 16px;
      box-shadow:
        0 1px 0 rgb(255 255 255 / 85%) inset,
        0 16px 36px rgb(39 57 92 / 12%);
    }

    .demo-page__mobile-group {
      display: flex;
      flex-direction: column;

      & + .demo-page__mobile-group {
        margin-top: 14px;
      }

      strong {
        padding: 6px 9px;
        color: #8792a4;
        font-size: 11px;
      }

      button {
        padding: 8px 9px;
        border: 0;
        border-radius: 8px;
        color: #5c687d;
        font-size: 13px;
        text-align: left;
        background: transparent;
        transition:
          color var(--demo-motion-fast) ease,
          background-color var(--demo-motion-fast) ease;

        &.is-active {
          color: var(--demo-brand);
          background: rgb(234 241 255 / 70%);
        }
      }
    }
  }
}

@media (max-width: 767px) {
  .demo-page {
    .demo-page__topbar {
      width: min(100% - 28px, 1380px);
      padding-top: 12px;
    }

    .demo-page__nav {
      min-height: 54px;
      border-radius: 16px;

      :deep(.liquid-glass__content) {
        padding: 0 14px;
      }
    }

    .demo-page__nav-actions {
      gap: 14px;

      > button:first-child,
      > a,
      .demo-page__version {
        display: none;
      }
    }

    .demo-page__mobile-trigger {
      max-width: 150px;
    }

    .demo-page__mobile-menu {
      top: 74px;
      right: 12px;
      left: 12px;
      width: auto;
    }

    .demo-page__main,
    .demo-page__footer {
      width: min(100% - 28px, 1380px);
    }

    .demo-page__hero {
      padding: 80px 0 88px;

      h1 {
        margin-top: 14px;
        font-size: 45px;
      }
    }

    .demo-page__lead {
      font-size: 16px;
    }

    .demo-page__hero-actions {
      align-items: stretch;
      flex-direction: column;

      button,
      a {
        text-align: center;
      }
    }

    .demo-page__capabilities {
      margin-top: 38px;
    }

    .demo-page__intro {
      grid-template-columns: 1fr;
      gap: 30px;
      padding: 54px 0 62px;

      h2 {
        font-size: 27px;
      }
    }

    .demo-page__install {
      grid-template-columns: minmax(0, 1fr) auto;

      span {
        display: none;
      }
    }

    .demo-page__layout {
      padding-bottom: 78px;
    }

    .demo-page__section-head {
      padding-top: 48px;

      h2 {
        font-size: 27px;
      }
    }

    .demo-page__demo {
      & + .demo-page__demo {
        padding-top: 38px;
      }
    }

    .demo-page__footer {
      min-height: 78px;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-page {
    .demo-page__hero,
    .demo-page__intro,
    .demo-page__demo {
      &.is-focused {
        animation: none;
        box-shadow: var(--demo-focus-ring);
      }
    }
  }
}
</style>
