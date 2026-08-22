import { getDb } from '../index'
import type { ColumnMap, DeliveryType, ScheduleImportResult, ScheduleItem, ScheduleItemInput } from '@shared/types'

type ScheduleItemRow = Omit<ScheduleItem, 'watched' | 'is_da_item'> & { watched: number; is_da_item: number }

function toScheduleItem(row: ScheduleItemRow): ScheduleItem {
  return { ...row, watched: !!row.watched, is_da_item: !!row.is_da_item }
}

export function listScheduleItems(projectId: number): ScheduleItem[] {
  const rows = getDb()
    .prepare('SELECT * FROM schedule_items WHERE project_id = ? ORDER BY due_date IS NULL, due_date, sort_order')
    .all(projectId) as ScheduleItemRow[]
  return rows.map(toScheduleItem)
}

export function createScheduleItem(input: ScheduleItemInput): ScheduleItem {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO schedule_items (project_id, name, due_date, status, sort_order, watched,
       start_date, resource_names, notes, is_da_item)
       VALUES (@project_id, @name, @due_date, @status, @sort_order, @watched,
       @start_date, @resource_names, @notes, @is_da_item)`
    )
    .run({ ...input, watched: input.watched ? 1 : 0, is_da_item: input.is_da_item ? 1 : 0 })
  return toScheduleItem(
    db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(result.lastInsertRowid) as ScheduleItemRow
  )
}

export function updateScheduleItem(id: number, input: Partial<ScheduleItemInput>): ScheduleItem {
  const db = getDb()
  const existing = toScheduleItem(db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(id) as ScheduleItemRow)
  const merged = {
    ...existing,
    ...input,
    id,
    watched: (input.watched ?? existing.watched) ? 1 : 0,
    is_da_item: (input.is_da_item ?? existing.is_da_item) ? 1 : 0
  }
  db.prepare(
    `UPDATE schedule_items SET name=@name, due_date=@due_date,
     status=@status, sort_order=@sort_order, watched=@watched, start_date=@start_date,
     resource_names=@resource_names, notes=@notes, is_da_item=@is_da_item,
     updated_at=datetime('now') WHERE id=@id`
  ).run(merged)
  return toScheduleItem(db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(id) as ScheduleItemRow)
}

export function deleteScheduleItem(id: number): void {
  getDb().prepare('DELETE FROM schedule_items WHERE id = ?').run(id)
}

export interface ScheduleImportRow {
  name: string
  due_date: string | null
  start_date: string | null
  resource_names: string | null
  flagged: boolean
  task_title: string | null
  task_delivery_type: DeliveryType | null
}

export function bulkImportScheduleItems(
  projectId: number,
  filePath: string,
  columnMap: ColumnMap,
  items: ScheduleImportRow[],
  replaceExisting = false
): ScheduleImportResult {
  const db = getDb()

  const tx = db.transaction(() => {
    if (replaceExisting) {
      db.prepare('DELETE FROM schedule_items WHERE project_id = ?').run(projectId)
    }

    const batchResult = db
      .prepare('INSERT INTO excel_imports (project_id, file_path, column_map, row_count) VALUES (?, ?, ?, ?)')
      .run(projectId, filePath, JSON.stringify(columnMap), items.length)
    const batchId = batchResult.lastInsertRowid as number

    const insertItem = db.prepare(
      `INSERT INTO schedule_items (project_id, name, due_date, status, source, import_batch_id,
       sort_order, watched, start_date, resource_names, is_da_item)
       VALUES (?, ?, ?, 'not_started', 'excel_import', ?, ?, ?, ?, ?, ?)`
    )

    const defaultCategory = db
      .prepare("SELECT id FROM task_categories WHERE project_id = ? AND name = 'Data Conversion'")
      .get(projectId) as { id: number } | undefined
    // Task due dates always come from the schedule row's own due date (the
    // workbook's Finish column) — never Start or anything else.
    const insertTask = db.prepare(
      `INSERT INTO tasks (project_id, category_id, title, status, due_date, delivery_type)
       VALUES (?, ?, ?, 'open', ?, ?)`
    )

    let tasksCreated = 0
    items.forEach((item, idx) => {
      insertItem.run(
        projectId,
        item.name,
        item.due_date,
        batchId,
        idx,
        item.flagged ? 1 : 0,
        item.start_date,
        item.resource_names,
        item.flagged ? 1 : 0
      )
      if (item.task_title && item.task_title.trim()) {
        insertTask.run(
          projectId,
          defaultCategory?.id ?? null,
          item.task_title.trim(),
          item.due_date,
          item.task_delivery_type
        )
        tasksCreated++
      }
    })

    return { batchId, count: items.length, tasksCreated }
  })

  return tx()
}
