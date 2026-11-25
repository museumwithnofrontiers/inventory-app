<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInventoryData } from '../composables/useInventoryData.js'

const route = useRoute()
const router = useRouter()
const { exhibitionById, exhibitionThemes, enCollectionTranslations, timelines, md, mdInline } = useInventoryData()

const exhibition = computed(() => exhibitionById(decodeURIComponent(route.params.exhibitionId)) ?? null)

const text = computed(() => {
  const e = exhibition.value
  return e ? (enCollectionTranslations.value[e.id] ?? {}) : {}
})

// "Introduction" is not a theme — it's the exhibition's own "About the
// Exhibition" text (the SH importer merges the legacy sh_exhibitionnames
// subtitle + introduction + curated_by into description) plus items attached
// directly to the exhibition collection (not to any theme/chapter).
const hasIntroduction = computed(() => {
  const e = exhibition.value
  if (!e) return false
  return (
    (e.items?.length ?? 0) > 0 ||
    !!text.value.description ||
    !!text.value.extra?.intro_text ||
    !!text.value.extra?.intro_header
  )
})

// The splash shows only the legacy subtitle teaser — the description's
// first paragraph (the importer writes the subtitle first). The full text
// lives on the introduction page, like legacy's exhibition homepage vs
// exh_introduction.php.
const teaser = computed(() => (text.value.description ?? '').split('\n\n')[0] ?? '')

const themeList = computed(() => {
  const e = exhibition.value
  if (!e) return []
  return exhibitionThemes(e.id).map(t => ({
    ...t,
    title: enCollectionTranslations.value[t.id]?.title ?? t.internal_name,
  }))
})

// ── "Related Content" — legacy exh_items.php sidebar: Political Context
// Timeline, this exhibition's Thematic Timeline, its Permanent Collection
// gallery, and the Further Reading bibliography. ──

const hasThematicTimeline = computed(() => {
  const e = exhibition.value
  return !!e && timelines.value.some(t => t.collection_id === e.id)
})

// The importer injects the legacy per-exhibition bibliography into every
// translation's extra.bibliography as the same language-keyed map.
const hasFurtherReading = computed(() => {
  const bib = text.value.extra?.bibliography
  return !!bib && Object.values(bib).some(entries => entries?.length)
})

function back() {
  if (window.history.length > 2) {
    router.back()
  } else {
    router.push('/exhibitions')
  }
}
</script>

<template>
  <div v-if="!exhibition" class="content-box not-found">
    <p>Exhibition not found.</p>
    <router-link to="/exhibitions">← Return to Exhibitions</router-link>
  </div>

  <div v-else>
    <a class="back-link" href="#" @click.prevent="back">← Back to Exhibitions</a>

    <h1 class="section-heading" v-html="mdInline(text.title ?? exhibition.internal_name)" />

    <div class="content-box intro-box">
      <h2 v-if="text.extra?.subtitle" class="intro-subtitle" v-html="mdInline(text.extra.subtitle)" />
      <div v-if="teaser" class="prose" v-html="md(teaser)" />
      <p v-if="text.extra?.exhibition_credits || text.extra?.credits" class="intro-credits" v-html="mdInline(text.extra.exhibition_credits || text.extra.credits)" />
    </div>

    <div class="content-box">
      <ul class="theme-list">
        <li
          v-if="hasIntroduction"
          class="theme-row"
          @click="$router.push(`/exhibitions/${exhibition.id}/introduction`)"
        >
          <span class="theme-name">About the Exhibition</span>
          <span class="theme-arrow">→</span>
        </li>
        <li
          v-for="t in themeList"
          :key="t.id"
          class="theme-row"
          @click="$router.push(`/exhibitions/${exhibition.id}/theme/${encodeURIComponent(t.id)}`)"
        >
          <span class="theme-name" v-html="mdInline(t.title)" />
          <span class="theme-arrow">→</span>
        </li>
      </ul>
      <p v-if="!hasIntroduction && !themeList.length" class="no-results">No content available for this exhibition yet.</p>
    </div>

    <!-- Legacy exhibition homepage "Related Content" box -->
    <div class="content-box related-box">
      <h3 class="related-heading">Related Content</h3>
      <ul class="related-list">
        <li>
          <router-link :to="{ path: '/timeline/results', query: { exhibition: 'pc' } }">
            Political Context Timeline
          </router-link>
        </li>
        <li v-if="hasThematicTimeline">
          <router-link :to="{ path: '/timeline/results', query: { exhibition: exhibition.id } }">
            Thematic Timeline
          </router-link>
        </li>
        <li>
          <router-link :to="{ path: '/permanent-collection/results', query: { exhibition: exhibition.id } }">
            See Gallery for this Theme
          </router-link>
        </li>
        <li v-if="hasFurtherReading">
          <router-link :to="`/exhibitions/${exhibition.id}/further-reading`">
            Further Reading
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.not-found { color: var(--muted); font-family: 'Roboto', sans-serif; font-size: 13px; }

.intro-box { border-top: 3px solid var(--accent); }
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
  white-space: pre-line;
}

.no-results { color: var(--muted); font-family: 'Roboto', sans-serif; font-size: 13px; padding: 20px 0; }

.theme-list { list-style: none; }
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border-light);
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

/* Related Content */
.related-box { border-top: 3px solid var(--accent); }
.related-heading {
  font-size: 14px;
  font-weight: 500;
  color: var(--heading);
  margin-bottom: 8px;
  font-family: 'Roboto', sans-serif;
}
.related-list {
  list-style: none;
  font-family: 'Roboto', sans-serif;
  font-size: 13px;
}
.related-list li { padding: 3px 0; }
.related-list a { color: var(--nav-active); }
</style>
