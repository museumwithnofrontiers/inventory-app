/**
 * Reads a label out of a legacy Vue client's source: the static text of one
 * element of a single-file component's template.
 *
 * The element is located by its structure — tag, id, class, attribute — with
 * a small CSS-like selector, never by the text it holds: the text is what is
 * being extracted. The template is parsed by Vue's own SFC compiler, never
 * matched with a regular expression.
 *
 * Selector grammar, one compound per step, steps joined by a space
 * (descendant) or ` > ` (child):
 *
 *   tag#id.class[name="value"][:name="expression"]:nth(0)
 *
 * `[:name="…"]` matches a bound attribute by its expression, whitespace
 * collapsed; `:nth(n)` keeps the n-th match (from 0) of its step. A selector
 * must end on exactly one element.
 */
import { parse } from '@vue/compiler-sfc'

// Vue's compiler-core NodeTypes, the few a template's text is made of.
const ELEMENT = 1
const TEXT = 2
const COMMENT = 3
const INTERPOLATION = 5
const ATTRIBUTE = 6
const DIRECTIVE = 7

interface TemplateProp {
  type: number
  name: string
  value?: { content: string }
  arg?: { content: string }
  exp?: { content: string }
}

interface TemplateNode {
  type: number
  tag?: string
  content?: unknown
  props?: TemplateProp[]
  children?: TemplateNode[]
}

export interface TemplateElement extends TemplateNode {
  type: typeof ELEMENT
  tag: string
  props: TemplateProp[]
  children: TemplateNode[]
}

interface Compound {
  tag?: string
  id?: string
  classes: string[]
  attributes: Array<{ name: string; bound: boolean; value: string }>
  nth?: number
}

interface Step {
  combinator: 'descendant' | 'child'
  compound: Compound
}

/** How an element's text is read. */
export interface TextOptions {
  /** Elements left out of the text (a compound each: `span`, `font-awesome-icon`, `router-link`). */
  exclude?: string[]
  /**
   * The branch taken in each `v-if` chain met, in the order they are met: a
   * label legacy renders in several forms is read one form at a time.
   */
  branches?: number[]
  /** Drops a leading step number ("1. Themes"): the site does not number its lists. */
  dropStepNumber?: boolean
  /**
   * Reads the static text beside a value the element interpolates ("Author:
   * {{ … }}" gives "Author:"): the value is data, the text around it the
   * label. Without it, an interpolation makes the element no label.
   */
  skipValues?: boolean
}

const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** Parses a single-file component and returns its template's root children. */
export function parseTemplate(source: string, filename: string): TemplateNode {
  const { descriptor, errors } = parse(source, {
    filename,
    templateParseOptions: { whitespace: 'preserve' },
  })
  if (errors.length > 0) {
    throw new Error(`${filename}: ${String(errors[0])}`)
  }
  const ast = descriptor.template?.ast as TemplateNode | undefined | null
  if (!ast) {
    throw new Error(`${filename}: no template`)
  }
  return ast
}

function parseCompound(text: string): Compound {
  const compound: Compound = { classes: [], attributes: [] }
  let rest = text
  const take = (pattern: RegExp): RegExpMatchArray | null => {
    const match = rest.match(pattern)
    if (match) rest = rest.slice(match[0].length)
    return match
  }
  const tag = take(/^[a-zA-Z][\w-]*/)
  if (tag) compound.tag = tag[0]
  for (;;) {
    const id = take(/^#([\w-]+)/)
    if (id) {
      compound.id = id[1]
      continue
    }
    const cls = take(/^\.([\w-]+)/)
    if (cls) {
      compound.classes.push(cls[1]!)
      continue
    }
    const attribute = take(/^\[(:?)([\w-]+)="([^"]*)"\]/)
    if (attribute) {
      compound.attributes.push({
        name: attribute[2]!,
        bound: attribute[1] === ':',
        value: collapse(attribute[3]!),
      })
      continue
    }
    const nth = take(/^:nth\((\d+)\)/)
    if (nth) {
      compound.nth = Number(nth[1])
      continue
    }
    break
  }
  if (rest !== '' || text === '') {
    throw new Error(`Unreadable selector step "${text}"`)
  }
  return compound
}

/** Splits a selector into its steps, keeping bracketed values whole. */
export function parseSelector(selector: string): Step[] {
  const tokens: string[] = []
  let current = ''
  let inBrackets = false
  for (const char of selector) {
    if (char === '[') inBrackets = true
    if (char === ']') inBrackets = false
    if (!inBrackets && /\s/.test(char)) {
      if (current !== '') tokens.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current !== '') tokens.push(current)

  const steps: Step[] = []
  let combinator: Step['combinator'] = 'descendant'
  for (const token of tokens) {
    if (token === '>') {
      combinator = 'child'
      continue
    }
    steps.push({ combinator, compound: parseCompound(token) })
    combinator = 'descendant'
  }
  if (steps.length === 0) {
    throw new Error(`Empty selector "${selector}"`)
  }
  return steps
}

const isElement = (node: TemplateNode): node is TemplateElement => node.type === ELEMENT

function staticAttribute(element: TemplateElement, name: string): string | undefined {
  const prop = element.props.find((p) => p.type === ATTRIBUTE && p.name === name)
  return prop?.value?.content
}

function boundAttribute(element: TemplateElement, name: string): string | undefined {
  const prop = element.props.find(
    (p) => p.type === DIRECTIVE && p.name === 'bind' && p.arg?.content === name
  )
  return prop?.exp?.content
}

function directive(node: TemplateNode, name: string): TemplateProp | undefined {
  return (node.props ?? []).find((p) => p.type === DIRECTIVE && p.name === name)
}

function matches(element: TemplateElement, compound: Compound): boolean {
  if (compound.tag !== undefined && element.tag !== compound.tag) return false
  if (compound.id !== undefined && staticAttribute(element, 'id') !== compound.id) return false
  const classes = (staticAttribute(element, 'class') ?? '').split(/\s+/)
  if (!compound.classes.every((c) => classes.includes(c))) return false
  return compound.attributes.every(({ name, bound, value }) => {
    const actual = bound ? boundAttribute(element, name) : staticAttribute(element, name)
    return actual !== undefined && collapse(actual) === value
  })
}

function childElements(node: TemplateNode): TemplateElement[] {
  return (node.children ?? []).filter(isElement)
}

function descendantElements(node: TemplateNode): TemplateElement[] {
  return childElements(node).flatMap((child) => [child, ...descendantElements(child)])
}

/** The one element a selector names in a template; throws unless there is exactly one. */
export function selectElement(root: TemplateNode, selector: string): TemplateElement {
  let context: TemplateNode[] = [root]
  for (const { combinator, compound } of parseSelector(selector)) {
    const found = new Set<TemplateElement>()
    for (const node of context) {
      const candidates = combinator === 'child' ? childElements(node) : descendantElements(node)
      for (const candidate of candidates) {
        if (matches(candidate, compound)) found.add(candidate)
      }
    }
    let list = [...found]
    if (compound.nth !== undefined) {
      list = list[compound.nth] ? [list[compound.nth]!] : []
    }
    context = list
  }
  if (context.length !== 1) {
    throw new Error(`Selector "${selector}" matches ${context.length} elements, not one`)
  }
  return context[0] as TemplateElement
}

/**
 * The text an element renders, whitespace collapsed. A dynamic part (an
 * interpolation, a `v-html`) makes it no label, and so does a `v-if` chain no
 * branch is given for: both throw.
 */
export function elementText(element: TemplateElement, options: TextOptions = {}): string {
  const exclude = (options.exclude ?? []).map(parseCompound)
  const branches = [...(options.branches ?? [])]

  const textOf = (node: TemplateNode): string => {
    if (directive(node, 'html')) {
      throw new Error(`<${node.tag}> renders HTML from data (v-html): no label`)
    }
    const children = node.children ?? []
    let text = ''
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!
      if (child.type === TEXT) {
        text += String(child.content)
      } else if (child.type === COMMENT) {
        continue
      } else if (child.type === INTERPOLATION) {
        if (options.skipValues) continue
        throw new Error(`<${node.tag}> interpolates a value: no label`)
      } else if (isElement(child)) {
        if (exclude.some((compound) => matches(child, compound))) continue
        if (!directive(child, 'if')) {
          text += textOf(child)
          continue
        }
        // A v-if chain: the element and the v-else-if / v-else siblings after it.
        const chain = [child]
        for (let j = i + 1; j < children.length; j++) {
          const next = children[j]!
          if (next.type === COMMENT || (next.type === TEXT && String(next.content).trim() === '')) {
            continue
          }
          if (isElement(next) && (directive(next, 'else-if') || directive(next, 'else'))) {
            chain.push(next)
            i = j
            continue
          }
          break
        }
        const branch = branches.shift()
        if (branch === undefined) {
          throw new Error(`<${node.tag}> holds a v-if chain and no branch is given for it`)
        }
        if (branch >= chain.length) {
          throw new Error(`<${node.tag}>: branch ${branch} of a ${chain.length}-branch v-if chain`)
        }
        text += textOf(chain[branch]!)
      }
    }
    return text
  }

  let text = collapse(textOf(element))
  if (branches.length > 0) {
    throw new Error(`<${element.tag}>: ${branches.length} branch(es) given for no v-if chain`)
  }
  if (options.dropStepNumber) {
    text = text.replace(/^\d+\.\s*/, '')
  }
  if (text === '') {
    throw new Error(`<${element.tag}> renders no text`)
  }
  return text
}
