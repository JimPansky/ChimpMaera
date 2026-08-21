#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG_VERSION = 'pansphaira.adaptive-controller/config-v1'
const RESULT_VERSION = 'pansphaira.adaptive-controller/result-v1'
const STATE_VERSION = 'pansphaira.adaptive-controller/state-v1'
const CONFIG_KEYS = ['controllerId', 'deadmanMs', 'enabled', 'expectedPhase', 'leaseDurationMs', 'maxExternalRetries', 'schemaVersion']
const RESULT_KEYS = ['evidenceDigest', 'observedAt', 'outcome', 'phase', 'schemaVersion']

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  throw new Error('NON_CANONICAL_VALUE')
}

export function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

function exactKeys(value, keys, code) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(code)
  const actual = Object.keys(value).sort()
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new Error(code)
}

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function validateConfig(config) {
  exactKeys(config, CONFIG_KEYS, 'INVALID_CONFIG_KEYS')
  if (config.schemaVersion !== CONFIG_VERSION || typeof config.controllerId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(config.controllerId)) throw new Error('INVALID_CONFIG_IDENTITY')
  if (typeof config.enabled !== 'boolean' || typeof config.expectedPhase !== 'string' || !/^[A-Z][A-Z0-9_]{2,63}$/.test(config.expectedPhase)) throw new Error('INVALID_CONFIG_MODE')
  if (!Number.isSafeInteger(config.maxExternalRetries) || config.maxExternalRetries < 1 || config.maxExternalRetries > 3) throw new Error('INVALID_RETRY_BOUND')
  if (!Number.isSafeInteger(config.leaseDurationMs) || config.leaseDurationMs < 1000 || config.leaseDurationMs > 300000) throw new Error('INVALID_LEASE_BOUND')
  if (!Number.isSafeInteger(config.deadmanMs) || config.deadmanMs < config.leaseDurationMs || config.deadmanMs > 600000) throw new Error('INVALID_DEADMAN_BOUND')
  return Object.freeze({ ...config })
}

export function validateResult(result, config, nowMs) {
  exactKeys(result, RESULT_KEYS, 'INVALID_RESULT_KEYS')
  if (result.schemaVersion !== RESULT_VERSION || result.phase !== config.expectedPhase) throw new Error('RESULT_BINDING_MISMATCH')
  if (!['COMPLETE', 'WAITING_EXTERNAL'].includes(result.outcome)) throw new Error('INVALID_RESULT_OUTCOME')
  if (typeof result.evidenceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(result.evidenceDigest)) throw new Error('INVALID_EVIDENCE_DIGEST')
  const observed = Date.parse(result.observedAt)
  if (!Number.isFinite(observed) || observed > nowMs || nowMs - observed > config.deadmanMs) throw new Error('STALE_RESULT')
  return Object.freeze({ ...result })
}

function withDigest(state) {
  const unsigned = { ...state }
  delete unsigned.stateDigest
  return { ...unsigned, stateDigest: digest(unsigned) }
}

function validateState(state, controllerId) {
  if (!state) return null
  if (state.schemaVersion !== STATE_VERSION || state.controllerId !== controllerId || !Number.isSafeInteger(state.sequence) || state.sequence < 0) throw new Error('INVALID_STATE')
  const expected = withDigest(state).stateDigest
  if (state.stateDigest !== expected) throw new Error('STATE_DIGEST_MISMATCH')
  return state
}

function atomicWrite(path, value, fault) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.tmp-${process.pid}-${randomUUID()}`
  let fd
  try {
    fd = openSync(temp, 'wx', 0o600)
    writeFileSync(fd, `${canonical(value)}\n`, 'utf8')
    fsyncSync(fd)
    closeSync(fd)
    fd = undefined
    if (fault === 'beforeRename') throw new Error('INJECTED_BEFORE_RENAME')
    renameSync(temp, path)
    const dirFd = openSync(dirname(path), 'r')
    fsyncSync(dirFd)
    closeSync(dirFd)
  } catch (error) {
    if (fd !== undefined) closeSync(fd)
    if (existsSync(temp)) unlinkSync(temp)
    throw error
  }
}

function readOptionalState(path, controllerId) {
  return existsSync(path) ? validateState(parseJson(path), controllerId) : null
}

export function runOnce({ configPath, resultPath, stateDir, nowMs = Date.now(), fault = null }) {
  const config = validateConfig(parseJson(resolve(configPath)))
  const root = resolve(stateDir)
  const statePath = join(root, 'state.json')
  const lkgPath = join(root, 'state.lkg.json')
  const lockPath = join(root, 'controller.lock')
  const disablePath = join(root, 'DISABLED')
  const prior = readOptionalState(statePath, config.controllerId)

  if (!config.enabled || existsSync(disablePath)) {
    return { status: 'DISABLED', mutated: false, stateDigest: prior?.stateDigest ?? null }
  }

  mkdirSync(root, { recursive: true, mode: 0o700 })
  if (existsSync(lockPath)) {
    const lock = parseJson(lockPath)
    if (!Number.isSafeInteger(lock.expiresAtMs) || nowMs <= lock.expiresAtMs + config.deadmanMs) throw new Error('LEASE_HELD')
    const attention = withDigest({
      schemaVersion: STATE_VERSION,
      controllerId: config.controllerId,
      sequence: (prior?.sequence ?? 0) + 1,
      status: 'ATTENTION',
      phase: config.expectedPhase,
      externalAttempts: prior?.externalAttempts ?? 0,
      retryExhausted: false,
      evidenceDigest: prior?.evidenceDigest ?? null,
      observedAt: new Date(nowMs).toISOString(),
      reason: 'DEADMAN_STALE_LEASE',
      priorStateDigest: prior?.stateDigest ?? null,
      leaseDigest: digest(lock)
    })
    if (prior) atomicWrite(lkgPath, prior)
    atomicWrite(statePath, attention, fault)
    return { status: attention.status, mutated: true, stateDigest: attention.stateDigest }
  }

  const lease = {
    controllerId: config.controllerId,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + config.leaseDurationMs,
    sequence: (prior?.sequence ?? 0) + 1,
    priorStateDigest: prior?.stateDigest ?? null
  }
  const leaseFd = openSync(lockPath, 'wx', 0o600)
  writeFileSync(leaseFd, `${canonical(lease)}\n`, 'utf8')
  fsyncSync(leaseFd)
  closeSync(leaseFd)

  try {
    const result = validateResult(parseJson(resolve(resultPath)), config, nowMs)
    const attempts = result.outcome === 'WAITING_EXTERNAL'
      ? Math.min((prior?.externalAttempts ?? 0) + 1, config.maxExternalRetries)
      : 0
    const next = withDigest({
      schemaVersion: STATE_VERSION,
      controllerId: config.controllerId,
      sequence: lease.sequence,
      status: result.outcome,
      phase: result.phase,
      externalAttempts: attempts,
      retryExhausted: result.outcome === 'WAITING_EXTERNAL' && attempts >= config.maxExternalRetries,
      evidenceDigest: result.evidenceDigest,
      observedAt: result.observedAt,
      reason: result.outcome === 'WAITING_EXTERNAL' ? 'EXTERNAL_EVIDENCE_PENDING' : 'VERIFIED_COMPLETE',
      priorStateDigest: prior?.stateDigest ?? null,
      leaseDigest: digest(lease)
    })
    if (prior) atomicWrite(lkgPath, prior)
    atomicWrite(statePath, next, fault)
    return { status: next.status, mutated: true, stateDigest: next.stateDigest, retryExhausted: next.retryExhausted }
  } finally {
    const currentLock = existsSync(lockPath) ? parseJson(lockPath) : null
    if (currentLock && digest(currentLock) === digest(lease)) unlinkSync(lockPath)
  }
}

function parseArgs(argv) {
  const allowed = new Set(['--config', '--result', '--state-dir'])
  const parsed = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.has(argv[i]) || typeof argv[i + 1] !== 'string') throw new Error('USAGE')
    parsed[argv[i].slice(2)] = argv[i + 1]
  }
  if (Object.keys(parsed).length !== 3) throw new Error('USAGE')
  return parsed
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2))
    process.stdout.write(`${canonical(runOnce({ configPath: args.config, resultPath: args.result, stateDir: args['state-dir'] }))}\n`)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = error.message === 'USAGE' ? 64 : 2
  }
}
