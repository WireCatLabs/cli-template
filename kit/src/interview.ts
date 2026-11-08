import type { Interface } from "node:readline/promises"
import type { Writable } from "node:stream"
import type { Kind } from "@wirecat/cli-core"

// Offered only for these categories; without it, for every category.
export type Choice = { value: string; label: string; categories?: string[] }

export type Question = {
  key: string
  flag: string
  text: string
  title?: string
  choices?: Choice[]
  multiple?: boolean
  exclusive?: string
  check?: (value: string) => string | undefined
  // Taken when the answer is missing, in a terminal on an empty line; only for text that is safe to edit later.
  fallback?: string
}

const npmName = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
const commandWord = /^[a-z][a-z0-9-]*$/
const githubOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/
const languageCode = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export const NAME_QUESTIONS: Question[] = [
  {
    key: "command",
    flag: "command",
    text: "The command word people type (lowercase, e.g. gcal)",
    check: (value) =>
      commandWord.test(value) ? undefined : "lowercase letters, digits and dashes, starting with a letter",
  },
  {
    key: "package",
    flag: "package",
    text: "The npm package name (e.g. @wirecat/gcal-cli)",
    check: (value) => (npmName.test(value) ? undefined : "a valid npm package name, scoped or not"),
  },
  {
    key: "owner",
    flag: "owner",
    text: "The GitHub owner of the repository (e.g. WireCatLabs)",
    check: (value) => (githubOwner.test(value) ? undefined : "a GitHub user or organisation name"),
  },
]

// Keyed by cli-core's kinds, so a kind cli-core adds fails the typecheck until it has a category here; a type import,
// so the kit still runs on Node alone. The values predate the kinds and stay, since scripts pass them to --category.
const CATEGORIES: Record<Kind, Choice> = {
  messages: { value: "messenger", label: "messenger" },
  mail: { value: "mail", label: "mail" },
  notes: { value: "notes", label: "notes" },
  documents: { value: "files", label: "files and documents" },
  meetings: { value: "meetings", label: "meetings" },
  events: { value: "calendar", label: "calendar" },
  crm: { value: "crm", label: "CRM (sales: deals, contacts, companies)" },
}

export const INTERVIEW: Question[] = [
  {
    key: "category",
    title: "Category",
    flag: "category",
    text: "What kind of tool is it?",
    choices: Object.values(CATEGORIES),
  },
  {
    key: "contentLang",
    title: "Content languages",
    flag: "content-lang",
    text: "Which languages is the content in? Language codes, several allowed (e.g. en,ru)",
    multiple: true,
    check: (value) => (languageCode.test(value) ? undefined : "a language code such as en, ru or pt-BR"),
  },
  {
    key: "signIn",
    title: "Sign-in",
    flag: "sign-in",
    text: "How does a person sign in?",
    choices: [
      { value: "oauth", label: "OAuth in the browser" },
      { value: "token", label: "an API token or key" },
      { value: "session", label: "a session (phone code, QR)" },
      { value: "none", label: "none" },
    ],
  },
  {
    key: "api",
    title: "The API",
    flag: "api",
    text: "What does the service offer to build on?",
    choices: [
      { value: "official-client", label: "an official API with an official client library" },
      { value: "official-docs", label: "official API documentation only" },
      { value: "unofficial", label: "nothing official" },
    ],
  },
  {
    key: "filters",
    title: "How people filter",
    flag: "filters",
    text: "How do people filter what they find? Several allowed",
    multiple: true,
    choices: [
      { value: "time", label: "by time" },
      { value: "person", label: "by person" },
      { value: "container", label: "by container (chat, folder, calendar)" },
      { value: "text", label: "by words in the text" },
      { value: "status", label: "by status or label" },
    ],
  },
  {
    key: "neverStore",
    title: "Never in the store, a log or the output",
    flag: "never-store",
    text: "What must never reach the store, a log or the output? Several allowed",
    multiple: true,
    choices: [
      { value: "tokens", label: "tokens and passwords" },
      { value: "codes", label: "one-time codes and passcodes" },
      { value: "secret-links", label: "links that carry a secret" },
      { value: "content", label: "the full content, keep only metadata" },
    ],
  },
  {
    key: "untrusted",
    title: "Untrusted input",
    flag: "untrusted",
    text: "What untrusted input arrives? Several allowed",
    multiple: true,
    exclusive: "none",
    choices: [
      { value: "messages", label: "messages from other people", categories: ["messenger", "mail"] },
      { value: "records", label: "deals, contacts and comments others entered", categories: ["crm"] },
      { value: "invitations", label: "invitations and event descriptions from others", categories: ["calendar"] },
      { value: "transcripts", label: "what other attendees said or wrote", categories: ["meetings"] },
      { value: "files", label: "files and attachments" },
      { value: "links", label: "links" },
      { value: "names", label: "names and titles set by others" },
      { value: "none", label: "none" },
    ],
  },
]

const OTHER = "other:"

// A flag still takes any choice, so a script written for one category keeps working; menus offer the category's own.
export const forCategory = (question: Question, category: string | undefined): Question =>
  category === undefined || !question.choices?.some((choice) => choice.categories)
    ? question
    : { ...question, choices: question.choices.filter((choice) => choice.categories?.includes(category) ?? true) }

export const choiceList = (question: Question): string =>
  question.choices
    ? `${question.choices.map((choice) => choice.value).join(", ")}, or ${OTHER}<your answer>`
    : (question.check?.("") ?? "")

const checkOne = (question: Question, value: string): string | undefined => {
  if (value.length === 0) return "empty answer"
  if (!question.choices) return question.check?.(value)
  if (value.startsWith(OTHER)) return value.length > OTHER.length ? undefined : `write the answer after "${OTHER}"`
  return question.choices.some((choice) => choice.value === value) ? undefined : `"${value}" is not one of the choices`
}

export const parseAnswer = (question: Question, raw: string): { value?: string[]; error?: string } => {
  const parts = question.multiple ? raw.split(",").map((part) => part.trim()) : [raw.trim()]
  for (const part of parts) {
    const problem = checkOne(question, part)
    if (problem) return { error: `--${question.flag}: ${problem}; expected ${choiceList(question)}` }
  }
  if (question.exclusive && parts.length > 1 && parts.includes(question.exclusive)) {
    return { error: `--${question.flag}: "${question.exclusive}" cannot be combined with other answers` }
  }
  return { value: [...new Set(parts)] }
}

export const labelOf = (question: Question, value: string): string =>
  value.startsWith(OTHER)
    ? `other: ${value.slice(OTHER.length)}`
    : (question.choices?.find((choice) => choice.value === value)?.label ?? value)

const menu = (question: Question): string =>
  [
    ...(question.choices ?? []).map((choice, index) => `  ${index + 1}. ${choice.label}`),
    `  ${(question.choices?.length ?? 0) + 1}. other (type it)`,
  ].join("\n")

const fromMenu = async (rl: Interface, question: Question, line: string): Promise<string> => {
  const choices = question.choices ?? []
  const picked: string[] = []
  for (const part of line.split(",")) {
    const index = Number(part.trim()) - 1
    if (index === choices.length) picked.push(`${OTHER}${(await rl.question("  Other: ")).trim()}`)
    else picked.push(choices[index]?.value ?? part.trim())
  }
  return picked.join(",")
}

export const ask = async (rl: Interface, output: Writable, question: Question): Promise<string[]> => {
  for (;;) {
    const prompt = question.choices
      ? `${question.text}\n${menu(question)}\n${question.multiple ? "Numbers, comma-separated: " : "Number: "}`
      : `${question.text}${question.fallback ? ` [${question.fallback}]` : ""}: `
    const line = (await rl.question(prompt)).trim()
    if (line === "" && question.fallback) return [question.fallback]
    const raw = question.choices && /^[\d,\s]+$/.test(line) ? await fromMenu(rl, question, line) : line
    const { value, error } = parseAnswer(question, raw)
    if (value) return value
    output.write(`${error}\n`)
  }
}
