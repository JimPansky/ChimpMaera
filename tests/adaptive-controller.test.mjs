import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { digest, runOnce } from '../scripts/adaptive-controller.mjs'

const NOW = Date.parse('2026-08-21T05:00:00.000Z')

function fixture({ enabled = true, outcome = 'COMPLETE', observedAt = '2026-08-21T04:59:59.000Z' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pansphaira-controller-'))
  const configPath = join(root, 'config.json')
  const resultPath = join(root, 'result.json')
  const stateDir = join(root, 'state')
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(configPath, JSON.stringify({
    schemaVersion: 'pansphaira.adaptive-controller/config-v1',
    controllerId: 'vf-m2-controller',
    enabled,
    expectedPhase: 'DELIVERY_READBACK',
    maxExternalRetries: 3,
    leaseDurationMs: 1000,
    deadmanMs: 2000
  }))
  writeFileSync(resultPath, JSON.stringify({
    schemaVersion: 'pansphaira.adaptive-controller/result-v1',
    phase: 'DELIVERY_READBACK',
    outcome,
    evidenceDigest: 'a'.repeat(64),
    observedAt
  }))
  return { root, configPath, resultPath, stateDir }
}

test('default-off performs no state mutation', () => {
  const input = fixture({ enabled: false })
  assert.deepEqual(runOnce({ ...input, nowMs: NOW }), { status: 'DISABLED', mutated: false, stateDigest: null })
  assert.throws(() => readFileSync(join(input.stateDir, 'state.json')), /ENOENT/)
})

test('happy run writes a digest-bound atomic state and restart advances monotonically', () => {
  const input = fixture()
  const first = runOnce({ ...input, nowMs: NOW })
  assert.equal(first.status, 'COMPLETE')
  const firstState = JSON.parse(readFileSync(join(input.stateDir, 'state.json')))
  assert.equal(firstState.sequence, 1)
  const second = runOnce({ ...input, nowMs: NOW + 1 })
  assert.equal(second.status, 'COMPLETE')
  const secondState = JSON.parse(readFileSync(join(input.stateDir, 'state.json')))
  assert.equal(secondState.sequence, 2)
  assert.equal(secondState.priorStateDigest, first.stateDigest)
  assert.equal(JSON.parse(readFileSync(join(input.stateDir, 'state.lkg.json'))).stateDigest, first.stateDigest)
})

test('external waits remain honest and retry count is bounded at three', () => {
  const input = fixture({ outcome: 'WAITING_EXTERNAL' })
  for (let run = 0; run < 8; run += 1) runOnce({ ...input, nowMs: NOW + run })
  const state = JSON.parse(readFileSync(join(input.stateDir, 'state.json')))
  assert.equal(state.status, 'WAITING_EXTERNAL')
  assert.equal(state.externalAttempts, 3)
  assert.equal(state.retryExhausted, true)
  assert.notEqual(state.status, 'COMPLETE')
})

test('disable marker stops a previously active controller without mutation', () => {
  const input = fixture()
  const first = runOnce({ ...input, nowMs: NOW })
  writeFileSync(join(input.stateDir, 'DISABLED'), 'operator disabled\n')
  const stopped = runOnce({ ...input, nowMs: NOW + 1 })
  assert.equal(stopped.status, 'DISABLED')
  assert.equal(stopped.stateDigest, first.stateDigest)
})

test('stale lease becomes ATTENTION and never success', () => {
  const input = fixture()
  writeFileSync(join(input.stateDir, 'controller.lock'), JSON.stringify({ controllerId: 'vf-m2-controller', issuedAtMs: NOW - 10000, expiresAtMs: NOW - 9000, sequence: 1, priorStateDigest: null }))
  const result = runOnce({ ...input, nowMs: NOW })
  assert.equal(result.status, 'ATTENTION')
})

test('active lease collision fails closed', () => {
  const input = fixture()
  writeFileSync(join(input.stateDir, 'controller.lock'), JSON.stringify({ controllerId: 'vf-m2-controller', issuedAtMs: NOW, expiresAtMs: NOW + 1000, sequence: 1, priorStateDigest: null }))
  assert.throws(() => runOnce({ ...input, nowMs: NOW }), /LEASE_HELD/)
})

test('malformed, stale and phase-drift results fail closed', () => {
  const input = fixture({ observedAt: '2026-08-21T04:00:00.000Z' })
  assert.throws(() => runOnce({ ...input, nowMs: NOW }), /STALE_RESULT/)
  const result = JSON.parse(readFileSync(input.resultPath))
  result.phase = 'OTHER_PHASE'
  result.observedAt = '2026-08-21T04:59:59.000Z'
  writeFileSync(input.resultPath, JSON.stringify(result))
  assert.throws(() => runOnce({ ...input, nowMs: NOW }), /RESULT_BINDING_MISMATCH/)
})

test('pre-rename fault preserves the prior state and removes the lease', () => {
  const input = fixture()
  const first = runOnce({ ...input, nowMs: NOW })
  assert.throws(() => runOnce({ ...input, nowMs: NOW + 1, fault: 'beforeRename' }), /INJECTED_BEFORE_RENAME/)
  assert.equal(JSON.parse(readFileSync(join(input.stateDir, 'state.json'))).stateDigest, first.stateDigest)
  assert.throws(() => readFileSync(join(input.stateDir, 'controller.lock')), /ENOENT/)
})

test('twenty-run soak is monotonic, restart-safe and residue-free', () => {
  const input = fixture()
  let prior = null
  for (let run = 0; run < 20; run += 1) {
    const current = runOnce({ ...input, nowMs: NOW + run })
    assert.notEqual(current.stateDigest, prior)
    prior = current.stateDigest
  }
  const state = JSON.parse(readFileSync(join(input.stateDir, 'state.json')))
  assert.equal(state.sequence, 20)
  assert.equal(state.stateDigest, digest(Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'stateDigest'))))
  assert.throws(() => readFileSync(join(input.stateDir, 'controller.lock')), /ENOENT/)
})
