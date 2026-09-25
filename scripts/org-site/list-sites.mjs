#!/usr/bin/env node
/**
 * Writes the list of websites the organization site
 * (museumwithnofrontiers.github.io) shows, as `sites.json`.
 *
 * A website is a repository created from one of `<owner>`'s three site templates
 * (`website-template`, `gallery-template`, `exhibition-template`): the rule
 * propagate.mjs (viewer-workflows) uses, so the org site lists exactly the sites
 * a platform release reaches, and there is no hand-kept list to drift. Titles and
 * kinds come from this repository's exporter instances
 * (`scripts/exporters/instances/<slug>.json`), whose slug is the site's repository
 * name. The address comes from the repository's GitHub Pages settings.
 *
 * Usage (Docker, with the operator's own gh login; see README.md):
 *   node scripts/org-site/list-sites.mjs [--owner <org>] [--out <file>]
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// viewer-workflows' `SITE_TEMPLATES` (tools/gh-lib.mjs), the same three.
export const SITE_TEMPLATES = ['website-template', 'gallery-template', 'exhibition-template']
const DEFAULT_OWNER = 'museumwithnofrontiers'
const HERE = dirname(fileURLToPath(import.meta.url))
const INSTANCES_DIR = resolve(HERE, '../exporters/instances')
const DEFAULT_OUT = resolve(HERE, '../../.new-architecture/museumwithnofrontiers.github.io/sites.json')

// Order of the groups on the page; a kind not listed here goes last.
export const KIND_ORDER = ['standalone', 'exhibition', 'gallery']

/** Slug → { title, kind } from every exporter instance file. */
export function readInstances(dir = INSTANCES_DIR) {
  const instances = new Map()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    if (data.slug) instances.set(data.slug, { title: data.name, kind: data.kind })
  }
  return instances
}

/** Whether `template` (a `template_repository`) is one of `owner`'s site templates. */
export function isSiteTemplate(owner, template) {
  return SITE_TEMPLATES.some((name) => template === `${owner}/${name}`)
}

/**
 * The sites to list, from the repositories found under `owner`.
 *
 * `repos` is `[{ name, template, hasPages, pagesUrl }]`, gathered by the caller,
 * so this decision logic is tested without a network call (as in propagate.mjs).
 * A site without GitHub Pages is not published yet, and is left out. A site with
 * no exporter instance is still listed, under its repository name, so a new
 * website can never silently miss the page.
 *
 * Throws when nothing matches: an empty list almost always means a wrong owner
 * or a broken discovery, never an estate with no websites.
 */
export function buildSiteList(owner, repos, instances) {
  const sites = repos
    .filter((repo) => isSiteTemplate(owner, repo.template) && repo.hasPages)
    .map((repo) => {
      const instance = instances.get(repo.name)
      return {
        slug: repo.name,
        title: instance?.title || repo.name,
        kind: instance?.kind || 'other',
        url: repo.pagesUrl || `https://${owner}.github.io/${repo.name}/`,
        repository: `https://github.com/${owner}/${repo.name}`,
      }
    })

  if (!sites.length) {
    throw new Error(
      `Found no published website under "${owner}" (repositories created from ` +
      `${SITE_TEMPLATES.map((name) => `${owner}/${name}`).join(', ')}, ` +
      'with GitHub Pages enabled). Check --owner, and that gh is logged in.'
    )
  }

  const rank = (kind) => (KIND_ORDER.includes(kind) ? KIND_ORDER.indexOf(kind) : KIND_ORDER.length)
  return sites.sort((a, b) => rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title, 'en'))
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
}

function discoverRepos(owner) {
  const names = gh([
    'api', `users/${owner}/repos?per_page=100&type=owner`, '--paginate',
    '--jq', '.[] | select(.archived == false and .private == false) | .name',
  ]).split('\n').filter(Boolean)

  return names.map((name) => {
    const [template, hasPages] = gh([
      'api', `repos/${owner}/${name}`, '--jq', '"\\(.template_repository.full_name // "")\\t\\(.has_pages)"',
    ]).split('\t')
    const repo = { name, template, hasPages: hasPages === 'true', pagesUrl: '' }
    if (isSiteTemplate(owner, repo.template) && repo.hasPages) {
      repo.pagesUrl = gh(['api', `repos/${owner}/${name}/pages`, '--jq', '.html_url'])
    }
    return repo
  })
}

function parseArgs(argv) {
  const args = { owner: DEFAULT_OWNER, out: DEFAULT_OUT }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--owner' || flag === '--out') {
      const value = argv[++i]
      if (!value) throw new Error(`${flag} needs a value`)
      args[flag.slice(2)] = flag === '--out' ? resolve(value) : value
    } else {
      throw new Error(`Unknown argument: ${flag}`)
    }
  }
  return args
}

function main() {
  const { owner, out } = parseArgs(process.argv.slice(2))
  console.log(`Discovering websites created from ${SITE_TEMPLATES.map((name) => `${owner}/${name}`).join(', ')}`)
  const sites = buildSiteList(owner, discoverRepos(owner), readInstances())
  writeFileSync(out, JSON.stringify({ owner, sites }, null, 2) + '\n')
  const counts = Object.entries(Object.groupBy(sites, (s) => s.kind)).map(([k, v]) => `${v.length} ${k}`)
  console.log(`Wrote ${sites.length} sites (${counts.join(', ')}) to ${out}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
