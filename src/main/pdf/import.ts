import { parsePrescriptiveSchedulePdf } from './scheduleParser'
import { bulkImportScheduleItems } from '../db/repositories/schedule'
import type { ScheduleImportRow } from '../db/repositories/schedule'
import type { ScheduleImportResult, PdfScheduleRow, PdfImportRow } from '@shared/types'

export function previewPdfSchedule(filePath: string): Promise<PdfScheduleRow[]> {
  return parsePrescriptiveSchedulePdf(filePath)
}

export function importPdfSchedule(
  projectId: number,
  filePath: string,
  rows: PdfImportRow[],
  replaceExisting = false
): ScheduleImportResult {
  const items: ScheduleImportRow[] = rows.map((r) => {
    // schedule_items.notes is reserved for the user's own manual notes (same
    // rule as Excel import), so any extracted context (time slots, deadline
    // explanations) is folded into the name instead of being lost.
    const name = r.notes ? `${r.name} (${r.notes})` : r.name
    return {
      name,
      due_date: r.due_date,
      start_date: null,
      resource_names: null,
      flagged: r.flagged,
      task_title: r.flagged ? r.name : null,
      task_delivery_type: null
    }
  })
  return bulkImportScheduleItems(
    projectId,
    filePath,
    { name: 'Action/Deadline', due_date: 'Date', flag_notes: 'flagged rows' },
    items,
    replaceExisting
  )
}
