<script setup>
import { computed } from 'vue'
import { useInventoryData } from '../composables/useInventoryData.js'

const { artIntroRoot, artIntroThemes, enCollectionTranslations, md, mdInline } = useInventoryData()

const rootText = computed(() => {
  const root = artIntroRoot.value
  if (!root) return {}
  return enCollectionTranslations.value[root.id] ?? {}
})

const themeList = computed(() =>
  artIntroThemes.value.map(theme => ({
    ...theme,
    title: enCollectionTranslations.value[theme.id]?.title ?? theme.internal_name,
  }))
)
</script>

<template>
  <div v-if="!artIntroRoot" class="content-box not-found">
    <p>Artistic Introduction is not available.</p>
  </div>

  <div v-else>
    <h1 class="section-heading">Artistic Introduction</h1>

    <div class="content-box intro-box">
      <h2 v-if="rootText.extra?.subtitle" class="intro-subtitle" v-html="mdInline(rootText.extra.subtitle)" />
      <div v-if="rootText.description" class="prose" v-html="md(rootText.description)" />
      <p v-if="rootText.extra?.exhibition_credits || rootText.extra?.credits" class="intro-credits" v-html="mdInline(rootText.extra.exhibition_credits || rootText.extra.credits)" />
    </div>

    <div class="content-box">
      <p class="intro-text">
        Select a theme below to explore its monuments and objects.
      </p>
      <ul class="theme-list">
        <li
          v-for="theme in themeList"
          :key="theme.id"
          class="theme-row"
          @click="$router.push(`/artistic-introduction/${encodeURIComponent(theme.id)}`)"
        >
          <span class="theme-name" v-html="mdInline(theme.title)" />
          <span class="theme-arrow">→</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.not-found { color: var(--muted); font-family: 'Roboto', sans-serif; font-size: 13px; }

.intro-box { border-top: 3px solid var(--gold-dark); }
.intro-subtitle {
  font-size: 16px;
  font-weight: 400;
  color: var(--heading);
  margin-bottom: 12px;
  font-family: 'Roboto', sans-serif;
}
.prose { font-size: 14px; line-height: 1.7; color: var(--text); font-family: 'Roboto', sans-serif; }
.prose :deep(p) { margin: 0 0 .75em; }
.prose :deep(p:last-child) { margin-bottom: 0; }

.intro-credits {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  font-style: italic;
  color: var(--muted);
  font-family: 'Roboto', sans-serif;
}

.intro-text {
  font-size: 13px;
  line-height: 1.65;
  color: var(--muted);
  margin-bottom: 16px;
  font-family: 'Roboto', sans-serif;
}

.theme-list { list-style: none; }
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px;
  border-bottom: 1px solid #e8dcc8;
  cursor: pointer;
}
.theme-row:last-child { border-bottom: none; }
.theme-row:hover .theme-name { color: var(--nav-active); }

.theme-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--heading);
  font-family: 'Roboto', sans-serif;
}
.theme-arrow {
  color: var(--muted);
  font-size: 14px;
}
</style>
