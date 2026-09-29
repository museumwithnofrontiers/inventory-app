/**
 * Reading a label out of a legacy Vue template. The templates are excerpts of
 * legacy's Explore client (bitbucket.org/mwnf/explore-client, master,
 * 2024-06-03), trimmed to the elements around each label.
 */
import { describe, expect, it } from 'vitest'

import {
  elementText,
  parseSelector,
  parseTemplate,
  selectElement,
  type TextOptions,
} from '../../src/core/vue-template.js'

const SIDE_NAVIGATION = `<template>
  <div id="side-navigation-container">
    <div id="side-navigation">
      <div id="side-navigation-title" @click="dropdownsClickHandler">
        <div>
          Make Your Selection
          <font-awesome-icon
            :icon="['fas', 'chevron-down']"
            v-if="lessThan1199 && !showAllDropdowns"
          />
          <font-awesome-icon
            :icon="['fas', 'chevron-up']"
            v-else-if="lessThan1199 && showAllDropdowns"
          />
        </div>
      </div>
      <div id="side-navigation-dropdowns" v-show="showAllDropdowns">
        <div class="side-navigation-select">
          <div v-if="theme">
            <label class="select-label" for="theme-select">1. Themes</label>
            <select id="theme-select" class="select" v-model="themeId">
              <option selected disabled value="">Select a Theme</option>
              <option v-for="theme in themes" :key="theme.themeId" :value="theme.themeId">
                {{ theme.themeName }}
              </option>
            </select>
          </div>
        </div>
        <div class="side-navigation-select">
          <div>
            <label class="select-label" for="country-select">
              <span v-if="!theme">1. </span>
              <span v-else>2. </span>
              Countries
            </label>
          </div>
        </div>
        <div class="side-navigation-select">
          <div>
            <p>
              You are currently exploring by
              <span class="bold" v-if="isItineraryPath">Itinerary.</span>
              <span class="bold" v-else-if="theme">Theme.</span>
              <span class="bold" v-else>Country.</span>
              To explore by
              <span v-if="isItineraryPath"
                >Theme or Country, or to see a full list of Itineraries,
              </span>
              <span v-else-if="!theme">Theme or Itinerary, </span>
              <span v-else>Country or Itinerary, </span>
              <router-link id="side-navigation-home" :to="{ name: 'home' }"
                >return to the
                <span class="bold">homepage.</span>
              </router-link>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>`

const APP = `<template>
  <div id="links-search-container">
    <div id="header-links" v-if="!lessThan949">
      <router-link :to="{ name: 'whats-new' }">What's New?</router-link>
      <router-link :to="{ name: 'about' }">About</router-link>
      <router-link :to="{ name: 'get-involved' }"
        >Get Involved</router-link
      >
    </div>
    <div id="copyright">
      Museum With No Frontiers (MWNF), 2004—{{ currentYear }}
    </div>
  </div>
</template>`

const read = (source: string, selector: string, options?: TextOptions): string =>
  elementText(selectElement(parseTemplate(source, 'Test.vue'), selector), options)

describe('parseSelector', () => {
  it('reads tags, ids, classes, attributes and positions, keeping a bracketed value whole', () => {
    expect(
      parseSelector(`#header-links > router-link[:to="{ name: 'whats-new' }"]:nth(0)`)
    ).toEqual([
      {
        combinator: 'descendant',
        compound: { id: 'header-links', classes: [], attributes: [] },
      },
      {
        combinator: 'child',
        compound: {
          tag: 'router-link',
          classes: [],
          attributes: [{ name: 'to', bound: true, value: "{ name: 'whats-new' }" }],
          nth: 0,
        },
      },
    ])
  })

  it('refuses what it cannot read', () => {
    expect(() => parseSelector('div~p')).toThrow('Unreadable selector step')
  })
})

describe('selectElement and elementText', () => {
  it("reads an element's static text, leaving out the elements it is told to", () => {
    expect(
      read(SIDE_NAVIGATION, '#side-navigation-title > div', {
        exclude: ['font-awesome-icon'],
      })
    ).toBe('Make Your Selection')
  })

  it('finds an element by a static attribute, and drops a step number on request', () => {
    expect(
      read(SIDE_NAVIGATION, 'label[for="theme-select"]', {
        dropStepNumber: true,
      })
    ).toBe('Themes')
    expect(
      read(SIDE_NAVIGATION, 'label[for="country-select"]', {
        exclude: ['span'],
      })
    ).toBe('Countries')
    expect(read(SIDE_NAVIGATION, 'select#theme-select > option[value=""]')).toBe('Select a Theme')
  })

  it('finds an element by a bound attribute, whatever its line breaks', () => {
    expect(read(APP, `#header-links > router-link[:to="{ name: 'whats-new' }"]`)).toBe(
      "What's New?"
    )
    expect(read(APP, `#header-links > router-link[:to="{ name: 'get-involved' }"]`)).toBe(
      'Get Involved'
    )
  })

  it('reads one form of a sentence legacy renders in several, a branch per v-if chain', () => {
    const exploring = { exclude: ['router-link'] }
    expect(
      read(SIDE_NAVIGATION, 'div.side-navigation-select p', {
        ...exploring,
        branches: [1, 2],
      })
    ).toBe('You are currently exploring by Theme. To explore by Country or Itinerary,')
    expect(
      read(SIDE_NAVIGATION, 'div.side-navigation-select p', {
        ...exploring,
        branches: [2, 1],
      })
    ).toBe('You are currently exploring by Country. To explore by Theme or Itinerary,')
    expect(read(SIDE_NAVIGATION, 'router-link#side-navigation-home')).toBe(
      'return to the homepage.'
    )
  })

  it('refuses a v-if chain no branch is given for', () => {
    expect(() => read(SIDE_NAVIGATION, 'label[for="country-select"]')).toThrow('no branch is given')
    expect(() =>
      read(SIDE_NAVIGATION, 'router-link#side-navigation-home', {
        branches: [0],
      })
    ).toThrow('for no v-if chain')
  })

  it('refuses a text built from data', () => {
    expect(() => read(APP, '#copyright')).toThrow('interpolates a value')
  })

  it('refuses a selector that names no element, or more than one', () => {
    expect(() => read(APP, '#footer-links')).toThrow('matches 0 elements')
    expect(() => read(APP, '#header-links > router-link')).toThrow('matches 3 elements')
    expect(read(APP, '#header-links > router-link:nth(1)')).toBe('About')
  })
})
