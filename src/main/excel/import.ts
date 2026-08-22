import * as XLSX from 'xlsx'
import { bulkImportScheduleItems } from '../db/repositories/schedule'
import type { ScheduleImportRow } from '../db/repositories/schedule'
import { bulkUpsertJiraItems } from '../db/repositories/jira'
import type {
  ExcelPreview,
  ColumnMap,
  DeliveryType,
  JiraColumnMap,
  JiraImportResult,
  ScheduleImportResult
} from '@shared/types'

export function previewExcelFile(filePath: string, sheetName?: string): ExcelPreview {
  const workbook = XLSX.readFile(filePath)
  const activeSheet = sheetName ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[activeSheet]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][]

  const headers = (data[0] ?? []).map((h) => String(h ?? ''))
  const rows = data.slice(1, 21) // preview first 20 data rows

  return { sheetNames: workbook.SheetNames, activeSheet, headers, rows }
}

function excelSerialToIso(value: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  // Already looks like an ISO/short date string
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  // Excel serial date number
  const serial = Number(trimmed)
  if (!isNaN(serial)) {
    const date = XLSX.SSF.parse_date_code(serial)
    if (date) {
      const iso = new Date(Date.UTC(date.y, date.m - 1, date.d))
      return iso.toISOString().slice(0, 10)
    }
  }
  return null
}

// Workflow vocabulary varies a lot between workbooks; fold common phrasing
// down to ProjectHub's fixed delivery-type vocabulary. "soft internal" is
// checked before the plain "internal" substring so it doesn't get swallowed.
function mapDeliveryType(raw: string): DeliveryType | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  if (s.includes('soft') && s.includes('internal')) return 'soft_internal_delivery'
  if (s.includes('internal')) return 'internal_delivery'
  if (s.includes('external')) return 'external_delivery'
  if (s.includes('meeting')) return 'meeting'
  if (s.includes('client')) return 'client_due_date'
  return null
}

export function importScheduleFromExcel(
  projectId: number,
  filePath: string,
  sheetName: string,
  columnMap: ColumnMap,
  replaceExisting = false
): ScheduleImportResult {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' })

  const field = (row: Record<string, string>, col: string | undefined): string =>
    col ? String(row[col] ?? '').trim() : ''

  const items = rows
    .map((row): ScheduleImportRow | null => {
      const name = field(row, columnMap.name)
      if (!name) return null
      const due_date = columnMap.due_date ? excelSerialToIso(field(row, columnMap.due_date)) : null
      const start_date = columnMap.start_date ? excelSerialToIso(field(row, columnMap.start_date)) : null
      const resource_names = field(row, columnMap.resource_names) || null
      const flagged = columnMap.flag_notes ? field(row, columnMap.flag_notes) !== '' : false
      const task_title = field(row, columnMap.task_title) || null
      const task_delivery_type = columnMap.task_delivery_type
        ? mapDeliveryType(field(row, columnMap.task_delivery_type))
        : null

      return {
        name,
        due_date,
        start_date,
        resource_names,
        flagged,
        task_title,
        task_delivery_type
      }
    })
    .filter((r): r is ScheduleImportRow => r !== null)

  return bulkImportScheduleItems(projectId, filePath, columnMap, items, replaceExisting)
}

export function importJiraFromFile(
  projectId: number,
  filePath: string,
  sheetName: string,
  columnMap: JiraColumnMap
): JiraImportResult {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' })

  const field = (row: Record<string, string>, col: string | undefined): string | undefined =>
    col ? String(row[col] ?? '').trim() : undefined

  const items = rows
    .map((row) => {
      const issue_id = field(row, columnMap.issue_id) ?? ''
      if (!issue_id) return null
      const issue_name = field(row, columnMap.issue_name) || issue_id
      return {
        issue_id,
        issue_name,
        description: field(row, columnMap.description),
        external_status: field(row, columnMap.external_status),
        priority: field(row, columnMap.priority),
        assignee: field(row, columnMap.assignee),
        jira_url: field(row, columnMap.jira_url)
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return bulkUpsertJiraItems(projectId, filePath, columnMap, items)
}
