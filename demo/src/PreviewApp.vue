<script setup lang="ts">
/**
 * 页面名称：DataGrid 独立场景预览
 * 页面 URL：/preview.html
 * 业务描述：在没有长页导航干扰的画布中运行单个 DataGrid 场景，并提供稳定分享地址。
 */

import { ref } from 'vue'
import { demoRegistry, findDemoById, getDemoPreviewHref } from './demo-registry'
import DemoScene from './components/DemoScene.vue'
import LiquidGlass from './components/LiquidGlass.vue'

const requestedDemoId = new URLSearchParams(window.location.search).get('demo')
const scene = findDemoById(requestedDemoId) ?? demoRegistry[0]!
const copied = ref(false)

document.title = `${scene.title} · DataGrid 独立预览`

async function copyPreviewLink() {
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}
</script>

<template>
  <div class="preview-page">
    <div class="preview-page__glow" aria-hidden="true" />

    <header class="preview-page__header">
      <!-- 液态玻璃独立预览导航 -->
      <LiquidGlass as="nav" aria-label="独立预览导航" class="preview-page__nav">
        <a class="preview-page__brand" :href="`./#${scene.id}`">
          <span aria-hidden="true">DG</span>
          DataGrid
        </a>
        <div class="preview-page__actions">
          <button type="button" @click="copyPreviewLink">
            {{ copied ? '链接已复制' : '复制预览链接' }}
          </button>
          <a :href="`./#${scene.id}`">返回全部演示</a>
        </div>
      </LiquidGlass>
    </header>

    <main class="preview-page__main">
      <header class="preview-page__intro">
        <p>独立场景 · {{ scene.level }}</p>
        <h1>{{ scene.title }}</h1>
        <span>当前页面只初始化一个 DataGrid，适合专注体验、调试和分享。</span>
      </header>

      <nav class="preview-page__switcher" aria-label="切换演示场景">
        <a
          v-for="item in demoRegistry"
          :key="item.id"
          :href="getDemoPreviewHref(item.id)"
          :aria-current="item.id === scene.id ? 'page' : undefined"
          :class="{ 'is-active': item.id === scene.id }"
        >
          <small>{{ item.level }}</small>
          {{ item.navLabel }}
        </a>
      </nav>

      <!-- DataGrid 演示场景 -->
      <DemoScene :scene="scene" :show-preview-link="false" />
    </main>
  </div>
</template>

<style scoped lang="scss">
.preview-page {
  position: relative;
  min-height: 100vh;
  overflow: clip;
  color: var(--demo-text);
  background: linear-gradient(180deg, #f7faff 0, #fff 560px, var(--demo-page) 900px);

  .preview-page__glow {
    position: absolute;
    top: -280px;
    right: -120px;
    width: 640px;
    height: 640px;
    border-radius: 50%;
    opacity: 0.38;
    background: radial-gradient(circle, #cbbcff 0, rgb(221 213 255 / 0%) 68%);
    pointer-events: none;
  }

  .preview-page__header {
    position: relative;
    z-index: 10;
    width: min(1240px, calc(100% - 48px));
    margin: 0 auto;
    padding-top: 20px;
  }

  .preview-page__nav {
    min-height: 58px;
    border-radius: 18px;

    :deep(.liquid-glass__content) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
    }
  }

  .preview-page__brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--demo-text);
    font-weight: 720;
    text-decoration: none;

    span {
      display: inline-flex;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      color: #fff;
      font-size: 11px;
      background: linear-gradient(145deg, #4679e2, #2855b9);
    }
  }

  .preview-page__actions {
    display: flex;
    align-items: center;
    gap: 18px;

    button,
    a {
      padding: 4px;
      border: 0;
      color: #53627a;
      font-size: 13px;
      text-decoration: none;
      background: transparent;
      cursor: pointer;

      &:hover {
        color: var(--demo-brand);
      }
    }
  }

  .preview-page__main {
    position: relative;
    z-index: 1;
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
    padding: 82px 0 100px;
  }

  .preview-page__intro {
    max-width: 720px;

    p {
      margin: 0 0 12px;
      color: #5b74a3;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
    }

    h1 {
      margin: 0 0 14px;
      font-size: clamp(38px, 5vw, 58px);
      letter-spacing: -0.045em;
    }

    span {
      color: var(--demo-muted);
      line-height: 1.8;
    }
  }

  .preview-page__switcher {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin: 36px 0 24px;

    a {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border: 1px solid #dfe6f1;
      border-radius: 9px;
      color: #5d6a7f;
      font-size: 13px;
      text-decoration: none;
      background: rgb(255 255 255 / 70%);
      box-shadow: 0 1px 1px rgb(31 47 75 / 2%);
      transition:
        border-color var(--demo-motion-fast) ease,
        color var(--demo-motion-fast) ease,
        background-color var(--demo-motion-fast) ease;

      &:hover {
        border-color: #cad5e5;
        color: #315fae;
        background: #fff;
      }

      &.is-active {
        border-color: #afc5ed;
        color: #2e5bab;
        background: #edf3ff;
      }
    }

    small {
      color: #8994a5;
      font-size: 10px;
    }
  }
}

@media (max-width: 767px) {
  .preview-page {
    .preview-page__header,
    .preview-page__main {
      width: min(100% - 24px, 1180px);
    }

    .preview-page__header {
      padding-top: 12px;
    }

    .preview-page__nav {
      min-height: 54px;

      :deep(.liquid-glass__content) {
        padding: 0 14px;
      }
    }

    .preview-page__actions {
      button {
        display: none;
      }
    }

    .preview-page__main {
      padding: 64px 0 72px;
    }

    .preview-page__switcher {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));

      a {
        justify-content: center;
        padding: 9px 6px;
      }

      small {
        display: none;
      }
    }
  }
}
</style>
