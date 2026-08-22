import { readFileSync } from 'fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PdfScheduleRow } from '@shared/types'

// Extracts the "Action/Deadline | Date | Notes" milestone table from a
// Prescriptive-template RE NXT project plan PDF. Unlike Excel (a real grid),
// a PDF only gives us positioned text runs, so this reconstructs the table
// using the same technique a proper PDF table extractor uses: cluster text
// into visual lines by Y-position, cluster lines into rows by Y-gap (a big
// gap between lines means a new row; a small gap means a wrapped line within
// the same cell), then bucket each row's text into columns by X-position,
// with boundaries derived from gaps in the data's own X-distribution.

interface TextItem {
  str: string
  x: number
  y: number
  width: number
}

const ROW_GAP_THRESHOLD = 15 // pt — gap larger than this between lines starts a new row
const WORD_GAP_THRESHOLD = 1.5 // pt — smaller than this, two text runs are the same word
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
]
const DATE_RE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})\\b`, 'i')

function parseDate(text: string): string | null {
  const m = text.match(DATE_RE)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const month = String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')
  return `${m[3]}-${month}-${day}`
}

// pdfjs-dist frequently splits a single word into multiple text runs (kerning
// pairs, ligatures) — e.g. "October" as "O" + "ctober", "18" as "1" + "8".
// Joining naively with a space between every run corrupts dates and words, so
// this only inserts a space where there's an actual visual gap between runs.
function joinWordAware(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  let result = ''
  let prevEnd: number | null = null
  for (const it of sorted) {
    if (prevEnd !== null && it.x - prevEnd > WORD_GAP_THRESHOLD) result += ' '
    result += it.str
    prevEnd = it.x + it.width
  }
  return result
}

function groupIntoLines(items: TextItem[]): { y: number; items: TextItem[] }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: { y: number; items: TextItem[] }[] = []
  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - it.y) < 2) {
      last.items.push(it)
    } else {
      lines.push({ y: it.y, items: [it] })
    }
  }
  return lines
}

// Header labels are often centered/padded within their column and don't sit
// at the same X as the column's actual left-aligned data below them, so
// column boundaries are derived from the data itself: the two largest gaps
// in the sorted set of distinct X-positions used by body text mark where one
// column ends and the next begins.
function findColumnBoundaries(bodyItems: TextItem[]): [number, number] | null {
  const xs = [...new Set(bodyItems.map((it) => Math.round(it.x)))].sort((a, b) => a - b)
  const gaps: { x: number; size: number }[] = []
  for (let i = 1; i < xs.length; i++) {
    const size = xs[i] - xs[i - 1]
    if (size > 15) gaps.push({ x: (xs[i - 1] + xs[i]) / 2, size })
  }
  gaps.sort((a, b) => b.size - a.size)
  if (gaps.length < 2) return null
  const [a, b] = gaps.slice(0, 2).sort((g1, g2) => g1.x - g2.x)
  return [a.x, b.x]
}

export async function parsePrescriptiveSchedulePdf(filePath: string): Promise<PdfScheduleRow[]> {
  const data = new Uint8Array(readFileSync(filePath))
  const doc = await getDocument({ data }).promise

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const raw = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter((it) => it.str && it.str.trim() !== '' && it.transform)
      .map((it) => ({ str: it.str as string, x: it.transform![4], y: it.transform![5], width: it.width ?? 0 }))
      // Drop footer/page-number text sitting near the bottom margin.
      .filter((it) => it.y > 40)

    const lines = groupIntoLines(raw)

    // Find the header line naming the three columns, just to know where the
    // table starts — its own X positions aren't used for column boundaries.
    const headerLineIdx = lines.findIndex((l) => {
      const text = l.items.map((i) => i.str).join(' ').toLowerCase()
      return (text.includes('action') || text.includes('deadline')) && text.includes('date')
    })
    if (headerLineIdx === -1) continue

    // Group lines after the header into rows using the Y-gap heuristic.
    const bodyLines = lines.slice(headerLineIdx + 1)
    const boundaries = findColumnBoundaries(bodyLines.flatMap((l) => l.items))
    if (!boundaries) continue
    const [dateX, notesX] = boundaries

    const rowGroups: { y: number; items: TextItem[] }[][] = []
    let current: { y: number; items: TextItem[] }[] = []
    let prevY: number | null = null
    for (const line of bodyLines) {
      if (prevY !== null && prevY - line.y > ROW_GAP_THRESHOLD && current.length > 0) {
        rowGroups.push(current)
        current = []
      }
      current.push(line)
      prevY = line.y
    }
    if (current.length > 0) rowGroups.push(current)

    const rows: PdfScheduleRow[] = []
    for (const group of rowGroups) {
      const nameLines: string[] = []
      const dateLines: string[] = []
      const notesLines: string[] = []
      for (const line of group) {
        const nameItems = line.items.filter((it) => it.x < dateX - 5)
        const dateItems = line.items.filter((it) => it.x >= dateX - 5 && it.x < notesX - 5)
        const notesItems = line.items.filter((it) => it.x >= notesX - 5)
        if (nameItems.length > 0) nameLines.push(joinWordAware(nameItems))
        if (dateItems.length > 0) dateLines.push(joinWordAware(dateItems))
        if (notesItems.length > 0) notesLines.push(joinWordAware(notesItems))
      }
      const name = nameLines.join(' ').replace(/\s+/g, ' ').trim()
      if (!name) continue
      const dateText = dateLines.join(' ')
      const due_date = parseDate(dateText)
      // Anything in the date column that isn't the date itself (e.g. a time
      // range like "11A-1P ET") is useful context — keep it in notes.
      const dateExtra = dateText.replace(DATE_RE, '').trim()
      const notes = [dateExtra, notesLines.join(' ').trim()].filter(Boolean).join(' — ') || null
      rows.push({ name, due_date, notes })
    }

    if (rows.length > 0) return rows
  }

  return []
}
