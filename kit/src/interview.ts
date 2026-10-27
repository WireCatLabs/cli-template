import type { Interface } from "node:readline/promises"
import type { Writable } from "node:stream"

export type Choice = { value: string; label: string }

export type Question = {
  key: string
  flag: string
  text: string
  title?: string
  choices?: Choice[]
  multiple?: boolean
  exclusive?: string
  check?: (value: string) => string | undefined
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

export const INTERVIEW: Question[] = [
  {
    key: "category",
    title: "Category",
    flag: "category",
    text: "What kind of tool is it?",
    choices: [
      { value: "messenger", label: "messenger" },
      { value: "mail", label: "mail" },
      { value: "notes", label: "notes" },
      { value: "files", label: "files and documents" },
      { value: "calendar", label: "calendar" },
      { value: "meetings", label: "meetings" },
    ],
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
      { value: "messages", label: "messages from other people" },
      { value: "files", label: "files and attachments" },
      { value: "links", label: "links" },
      { value: "names", label: "names and titles set by others" },
      { value: "none", label: "none" },
    ],
  },
]

const OTHER = "other:"

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
      : `${question.text}: `
    const line = (await rl.question(prompt)).trim()
    const raw = question.choices && /^[\d,\s]+$/.test(line) ? await fromMenu(rl, question, line) : line
    const { value, error } = parseAnswer(question, raw)
    if (value) return value
    output.write(`${error}\n`)
  }
}
