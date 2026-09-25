<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  partnerFromKey, partnerRoute, partnerObjectsRoute, partnerLabel, countryLabel,
  tr, loadTranslations, availableLanguages, defaultLang, languageByCode, md,
} from '../composables/useGalleryData.js'
import { tIn, isRtl } from '../composables/useUiStrings.js'
import BackLink from '../components/BackLink.vue'
import PartnerMap from '../components/PartnerMap.vue'

const route = useRoute()
const router = useRouter()

const partner = computed(() => partnerFromKey(route.params.country, route.params.id))
const lang = computed(() => route.params.language ?? defaultLang)
const rtl = computed(() => isRtl(lang.value))
const ready = ref(false)

// Which languages this partner record actually has. Legacy read `i18nLinks`;
// here it is which translation files carry a row for this partner — the
// package omits a file entirely when nothing in it has a translation.
const partnerLanguages = computed(() => {
  const p = partner.value
  if (!p) return [defaultLang]
  return availableLanguages('partners').filter(code => {
    const rows = tr('partners', p.id, code)
    return code === defaultLang || Boolean(rows?.name)
  })
})

async function load() {
  ready.value = false
  if (!partner.value) { router.replace({ name: 'error' }); return }
  await Promise.all(availableLanguages('partners').map(code => loadTranslations('partners', code)))
  await loadTranslations('partners', lang.value)
  ready.value = true
}
onMounted(load)
watch(() => [route.params.country, route.params.id, route.params.language].join('|'), load)

const info = computed(() => (partner.value ? tr('partners', partner.value.id, lang.value) : {}))

const tab = ref('description')
const photos = computed(() =>
  [...(partner.value?.images ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
)
const currentPhoto = ref(0)
const lightbox = ref(false)

function slide(direction) {
  const n = photos.value.length
  if (!n) return
  currentPhoto.value = (currentPhoto.value + (direction === 'right' ? 1 : -1) + n) % n
}

const contacts = computed(() =>
  (partner.value?.contact_persons ?? []).filter(Boolean)
)
const hasContact = computed(() =>
  Boolean(info.value.address || info.value.phone || info.value.email || info.value.website || contacts.value.length)
)

function languageName(code) {
  return languageByCode.value.get(code)?.names?.[code] ?? code.toUpperCase()
}

function setLanguage(code) {
  if (code === lang.value) return
  router.push(partnerRoute(partner.value, code))
}

const website = computed(() => {
  const url = info.value.website
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
})
</script>

<template>
  <div id="partner-profile-wrapper" v-if="partner">
    <div id="profile-languages">
      <button
        v-for="code in partnerLanguages"
        :key="code"
        class="languages-button"
        :class="{ 'language-selected': code === lang }"
        @click="setLanguage(code)"
      >{{ languageName(code) }}</button>
    </div>

    <BackLink />

    <div v-if="!ready" class="loader">Loading…</div>

    <div v-else id="partner-profile" :dir="rtl ? 'rtl' : 'ltr'">
      <p id="partner-name">{{ partnerLabel(partner.id) }}</p>
      <p id="partner-location">
        <span v-if="info.city">{{ info.city }}, </span>{{ countryLabel(partner.country_id) }}
      </p>

      <div id="partner-links-container">
        <div id="partner-links">
          <button :class="{ active: tab === 'description' }" @click="tab = 'description'">About</button>
          <template v-if="hasContact">
            <span class="divider">|</span>
            <button :class="{ active: tab === 'contact' }" @click="tab = 'contact'">Contact</button>
          </template>
          <template v-if="partner.logos?.length">
            <span class="divider">|</span>
            <button :class="{ active: tab === 'logo' }" @click="tab = 'logo'">Logo</button>
          </template>
          <template v-if="website">
            <span class="divider">|</span>
            <a :href="website" target="_blank" rel="noopener">↗ Go to the Partner’s homepage</a>
          </template>
        </div>
        <div id="partner-objects-link" v-if="partner.item_count">
          <RouterLink class="legacy-button" :to="partnerObjectsRoute(partner)">View Objects</RouterLink>
        </div>
      </div>

      <div id="profile-photo-wrapper">
        <div class="profile-photo-container">
          <template v-if="photos.length">
            <div class="profile-photo" @click="lightbox = true">
              <img :src="photos[currentPhoto].url" :alt="partnerLabel(partner.id)" />
            </div>
            <div id="profile-thumbnail-container" v-if="photos.length > 1">
              <div
                v-for="(pic, index) in photos"
                :key="pic.url"
                class="profile-thumbnail"
                :class="{ active: index === currentPhoto }"
                @click="currentPhoto = index"
              >
                <img :src="pic.url" :alt="`${partnerLabel(partner.id)} — ${index + 1}`" />
                <div class="tooltip-text" v-if="pic.photographer || pic.copyright">
                  <div v-if="pic.photographer">{{ tIn(lang, 'photograph') }}: {{ pic.photographer }}</div>
                  <div v-if="pic.copyright">© {{ pic.copyright }}</div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div id="profile-info-container">
          <div class="prose" v-if="tab === 'description'" v-html="md(info.description)"></div>

          <div v-else-if="tab === 'contact'">
            <p class="contact-header">Address(es)</p>
            <div class="prose" v-html="md(info.address)"></div>
            <p v-if="info.phone">T {{ info.phone }}</p>
            <p v-if="info.email"><a :href="`mailto:${info.email}`">{{ info.email }}</a></p>
            <p v-if="website"><a :href="website" target="_blank" rel="noopener">{{ info.website }}</a></p>
            <div class="contact-person" v-for="person in contacts" :key="person.name ?? person.email">
              <p class="contact-title" v-if="person.title">{{ person.title }}</p>
              <p v-if="person.name">{{ person.name }}</p>
              <p v-if="person.phone">T {{ person.phone }}</p>
              <p v-if="person.fax">F {{ person.fax }}</p>
              <p v-if="person.email"><a :href="`mailto:${person.email}`">{{ person.email }}</a></p>
            </div>
            <div class="additional-urls" v-if="partner.additional_urls?.length">
              <p v-for="entry in partner.additional_urls" :key="entry.url">
                <a :href="entry.url" target="_blank" rel="noopener">{{ entry.url }}</a>
              </p>
            </div>
          </div>

          <div id="partner-logo-container" v-else-if="tab === 'logo'">
            <img v-for="logo in partner.logos" :key="logo.url" :src="logo.url" :alt="partnerLabel(partner.id)" />
          </div>
        </div>
      </div>

      <PartnerMap
        :latitude="partner.latitude"
        :longitude="partner.longitude"
        :zoom="partner.map_zoom"
        :label="partnerLabel(partner.id)"
      />
    </div>

    <div id="lightbox-container" v-if="lightbox" @click="lightbox = false">
      <button class="lightbox-control" v-if="photos.length > 1" @click.stop="slide('left')">‹</button>
      <img :src="photos[currentPhoto].url" :alt="partnerLabel(partner.id)" />
      <button class="lightbox-control" v-if="photos.length > 1" @click.stop="slide('right')">›</button>
    </div>
  </div>
</template>

<style scoped>
#partner-profile-wrapper { background: #fff; width: 100%; min-height: 400px; padding-bottom: 40px; }
#profile-languages { display: flex; flex-wrap: wrap; gap: 2px; background: var(--background-color); padding: 6px 20px; }
.languages-button {
  background: none;
  border: 1px solid var(--theme-medium);
  color: var(--theme-dark);
  font-family: inherit;
  font-size: 13px;
  padding: 3px 10px;
  cursor: pointer;
}
.languages-button.language-selected { background: var(--theme-medium-dark); color: #fff; border-color: var(--theme-medium-dark); }

#partner-profile { padding: 0 40px; }
#partner-name { font-size: 24px; font-weight: 700; color: var(--theme-dark); }
#partner-location { color: #555; margin-bottom: 12px; }

#partner-links-container {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--background-color);
  padding: 8px 12px;
}
#partner-links { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
#partner-links button {
  background: none;
  border: none;
  font-family: inherit;
  font-size: 15px;
  color: var(--theme-dark);
  cursor: pointer;
}
#partner-links button.active { font-weight: 700; text-decoration: underline; }
#partner-links a { color: var(--link-blue); font-size: 14px; }
.divider { color: #b08; opacity: 0.4; }
#partner-objects-link a { text-decoration: none; }

#profile-photo-wrapper { display: flex; gap: 26px; align-items: flex-start; padding-top: 18px; }
.profile-photo-container { flex: 0 0 38%; max-width: 38%; }
.profile-photo { cursor: zoom-in; }
.profile-photo img { width: 100%; display: block; }
#profile-thumbnail-container { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; }
.profile-thumbnail { position: relative; width: 64px; height: 64px; cursor: pointer; border: 2px solid transparent; }
.profile-thumbnail.active { border-color: var(--theme-medium-dark); }
.profile-thumbnail img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tooltip-text {
  display: none;
  position: absolute;
  bottom: 100%;
  inset-inline-start: 0;
  background: rgba(0,0,0,0.8);
  color: #fff;
  font-size: 11px;
  padding: 6px;
  width: 200px;
  z-index: 20;
}
.profile-thumbnail:hover .tooltip-text { display: block; }

#profile-info-container { flex: 1; min-width: 0; line-height: 1.55; }
.contact-header { font-weight: 700; color: var(--theme-dark); margin-bottom: 4px; }
.contact-person { margin-top: 12px; }
.contact-title { font-style: italic; }
#profile-info-container a { color: var(--link-blue); }
#partner-logo-container img { max-width: 200px; display: block; margin-bottom: 12px; }
.additional-urls { margin-top: 12px; word-break: break-all; }

#lightbox-container {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}
#lightbox-container img { max-width: 88vw; max-height: 88vh; }
.lightbox-control { background: none; border: none; color: #fff; font-size: 60px; cursor: pointer; padding: 0 20px; }

@media only screen and (max-width: 849px) {
  #profile-photo-wrapper { flex-direction: column; }
  .profile-photo-container { max-width: 100%; flex: none; width: 100%; }
}
</style>
