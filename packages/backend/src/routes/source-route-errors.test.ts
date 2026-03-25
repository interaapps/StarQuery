import test from 'node:test'
import assert from 'node:assert/strict'
import { isUniqueConstraintError } from './source-route-errors.ts'

test('detects MySQL duplicate key errors', () => {
  assert.equal(
    isUniqueConstraintError({
      code: 'ER_DUP_ENTRY',
      sqlState: '23000',
      sqlMessage: "Duplicate entry 'test' for key 'data_sources_project_name_unique'",
    }),
    true,
  )
})

test('detects SQLite unique constraint errors', () => {
  assert.equal(
    isUniqueConstraintError({
      code: 'SQLITE_CONSTRAINT_UNIQUE',
      message: 'UNIQUE constraint failed: data_sources.project_id, data_sources.name',
    }),
    true,
  )
})

test('does not classify unrelated errors as unique conflicts', () => {
  assert.equal(
    isUniqueConstraintError({
      code: 'ER_BAD_FIELD_ERROR',
      sqlState: '42S22',
      sqlMessage: "Unknown column 'foo' in 'field list'",
    }),
    false,
  )
})
