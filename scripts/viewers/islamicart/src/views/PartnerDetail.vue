<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInventoryData } from '../composables/useInventoryData.js'

const route = useRoute()
const router = useRouter()
const {
  partners, items,
  availableLangs, defaultLang,
  countryLabel, md, mdInline,
} = useInventoryData()

const partner = computed(() => partners.value.find(p => p.id === decodeURIComponent(route.params.id)) ?? null)

// ── Language selector (partner translations are loaded on demand, per-lang) ──

const activeLang = ref(defaultLang)
const partnerTranslationsCache = ref({})

async function loadPartnerLangTranslations(lang) {
  if (partnerTranslationsCache.value[lang]) return
  try {
    const m = await import(`@inventory-data/translations/partners.${lang}.json`)
    partnerTranslationsCache.value = { ...partnerTranslationsCache.value, [lang]: m.default }
  } catch {
    partnerTranslationsCache.value = { ...partnerTranslationsCache.value, [lang]: {} }
  }
}

onMounted(() => loadPartnerLangTranslations(activeLang.value))
watch(activeLang, lang => loadPartnerLangTranslations(lang))

const t = computed(() => partnerTranslationsCache.value[activeLang.value]?.[partner.value?.id] ?? {})

// ── Related items (View Objects / View Monuments) ────────────────────────

const relatedItems = computed(() => {
  if (!partner.value) return []
  return items.value.filter(i => i.partner_id === partner.value.id)
})

const viewItemsLabel = computed(() => (partner.value?.type === 'institution' ? 'View Monuments' : 'View Objects'))

function viewItemsLink() {
  return { path: '/permanent-collection/results', query: { partner: partner.value.id } }
}

// ── Contact ────────────────────────────────────────────────────────────

const hasContactInfo = computed(() =>
  !!(t.value.address || t.value.phone || t.value.email || t.value.website || partner.value?.additional_urls?.length)
)

function normalizeUrl(url) {
  return url.startsWith('http') ? url : `http://${url}`
}

const contactPersons = computed(() => {
  if (!partner.value) return []
  return (partner.value.contact_persons ?? []).filter(
    cp => cp && (cp.name || cp.title)
  )
})

// ── Map (OpenStreetMap embed — no API key required) ───────────────────────

const mapEmbedUrl = computed(() => {
  if (partner.value?.type !== 'museum') return null
  const { latitude: lat, longitude: lon } = partner.value
  if (lat == null || lon == null) return null
  const delta = 0.01
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`
})

function imageCredit(img) {
  const parts = []
  if (img.copyright) parts.push(`© ${img.copyright}`)
  if (img.photographer) parts.push(img.photographer)
  return parts.join(' — ')
}

function back() {
  if (window.history.length > 2) {
    router.back()
  } else {
    router.push('/partners')
  }
}
</script>

<template>
  <div v-if="!partner" class="content-box not-found">
    <p>Partner not found.</p>
    <router-link to="/partners">← Return to Partners</router-link>
  </div>

  <div v-else class="detail-wrap">
    <a class="back-link" href="#" @click.prevent="back">← Back to Partners</a>

    <div v-if="availableLangs.length > 1" class="lang-selector">
      <label class="lang-label">Partner language:</label>
      <select v-model="activeLang" class="lang-select">
        <option v-for="lang in availableLangs" :key="lang" :value="lang">{{ lang.toUpperCase() }}</option>
      </select>
    </div>

    <div class="detail content-box">
      <div class="detail-type-badge">{{ partner.type }}</div>

      <h1 class="detail-title" v-html="mdInline(t.name ?? partner.id)" />
      <h2 v-if="t.city || partner.country_id" class="detail-subtitle">
        <template v-if="t.city">{{ t.city }}<template v-if="partner.country_id">, </template></template>
        <template v-if="partner.country_id">{{ countryLabel(partner.country_id) }}</template>
      </h2>

      <!-- View objects / monuments -->
      <div v-if="relatedItems.length" class="view-items-row">
        <RouterLink :to="viewItemsLink()" class="btn">{{ viewItemsLabel }} ({{ relatedItems.length }}) →</RouterLink>
        <a v-if="t.website" :href="normalizeUrl(t.website)" target="_blank" rel="noopener" class="homepage-link">
          Visit Website ↗
        </a>
      </div>

      <!-- Images -->
      <div v-if="partner.images?.length" class="images">
        <figure v-for="(img, i) in partner.images" :key="i">
          <img :src="img.url" :alt="img.alt_text ?? ''" loading="lazy" class="detail-img" />
          <figcaption v-if="img.alt_text || imageCredit(img)">
            <span v-if="img.alt_text">{{ img.alt_text }}</span>
            <span v-if="imageCredit(img)" class="photo-credit">{{ imageCredit(img) }}</span>
          </figcaption>
        </figure>
      </div>

      <!-- About -->
      <section v-if="t.description" class="content-section">
        <h2 class="content-section-heading">About</h2>
        <div v-html="md(t.description)" class="prose" />
      </section>

      <!-- Contact -->
      <section v-if="hasContactInfo || contactPersons.length" class="content-section">
        <h2 class="content-section-heading">Contact</h2>

        <div v-if="hasContactInfo" class="contact-block">
          <p v-if="t.address" class="contact-address">{{ t.address }}</p>
          <p v-if="t.phone">Phone: {{ t.phone }}</p>
          <p v-if="t.email"><a :href="`mailto:${t.email}`">{{ t.email }}</a></p>
          <p v-if="t.website">
            <a :href="normalizeUrl(t.website)" target="_blank" rel="noopener">{{ t.website }}</a>
            <template v-for="(u, i) in partner.additional_urls" :key="i">
              &nbsp;|&nbsp;<a :href="normalizeUrl(u.url)" target="_blank" rel="noopener">{{ u.title ?? u.url }}</a>
            </template>
          </p>
        </div>

        <div v-for="(cp, i) in contactPersons" :key="i" class="contact-block contact-person">
          <p v-if="cp.title" class="contact-person-title">{{ cp.title }}</p>
          <p v-if="cp.name">{{ cp.name }}</p>
          <p v-if="cp.phone">Phone: {{ cp.phone }}</p>
          <p v-if="cp.fax">Fax: {{ cp.fax }}</p>
          <p v-if="cp.email"><a :href="`mailto:${cp.email}`">{{ cp.email }}</a></p>
        </div>
      </section>

      <!-- Logos -->
      <section v-if="partner.logos?.length" class="content-section">
        <h2 class="content-section-heading">Logo</h2>
        <div class="logos">
          <img v-for="(logo, i) in partner.logos" :key="i" :src="logo.url" :alt="logo.alt_text ?? ''" class="logo-img" />
        </div>
      </section>

      <!-- Map -->
      <section v-if="mapEmbedUrl" class="content-section">
        <h2 class="content-section-heading">Map</h2>
        <iframe class="map-frame" :src="mapEmbedUrl" loading="lazy" title="Partner location map" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.not-found { color: var(--muted); font-family: 'Roboto', sans-serif; font-size: 13px; }

.detail-wrap { display: flex; flex-direction: column; gap: 10px; }

.lang-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Roboto', sans-serif;
  font-size: 12px;
  color: var(--muted);
  justify-content: flex-end;
}
.lang-select { font-size: 12px; padding: 3px 6px; }

.detail-type-badge {
  display: inline-block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--heading);
  border: 1px solid var(--gold-dark);
  padding: 2px 8px;
  margin-bottom: 10px;
  font-family: 'Roboto', sans-serif;
}

.detail-title {
  font-size: 24px;
  font-weight: 400;
  color: var(--heading);
  margin-bottom: 4px;
  line-height: 1.3;
  font-family: 'Roboto', sans-serif;
}
.detail-subtitle {
  font-size: 14px;
  font-weight: 400;
  font-style: italic;
  color: var(--muted);
  margin-bottom: 16px;
  font-family: 'Roboto', sans-serif;
}

.view-items-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.homepage-link {
  font-size: 13px;
  font-weight: 500;
  color: var(--nav-active);
  font-family: 'Roboto', sans-serif;
}

/* Images */
.images {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.images figure { flex-shrink: 0; }
.detail-img {
  width: 180px;
  height: 140px;
  object-fit: cover;
  border: 1px solid var(--border);
  display: block;
}
.images figcaption {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
  width: 180px;
  font-family: 'Roboto', sans-serif;
}
.photo-credit { display: block; }

/* Content sections */
.content-section {
  margin-bottom: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.content-section-heading {
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--heading);
  margin-bottom: 10px;
  font-family: 'Roboto', sans-serif;
}

.prose { font-size: 14px; line-height: 1.7; color: var(--text); font-family: 'Roboto', sans-serif; }
.prose :deep(p) { margin: 0 0 .75em; }
.prose :deep(p:last-child) { margin-bottom: 0; }

.contact-block {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
  font-family: 'Roboto', sans-serif;
  margin-bottom: 12px;
}
.contact-person {
  padding-left: 12px;
  border-left: 3px solid var(--gold-dark);
}
.contact-person-title { font-weight: 500; color: var(--heading); }
.contact-address { white-space: pre-line; }

.logos { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.logo-img { max-height: 80px; max-width: 200px; object-fit: contain; }

.map-frame {
  width: 100%;
  height: 380px;
  border: 1px solid var(--border);
}
</style>
