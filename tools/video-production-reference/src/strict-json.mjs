// Strict JSON boundary shared by file and direct API inputs.
// It rejects JavaScript-only object features and parses textual JSON itself so
// duplicate object keys cannot be hidden by JSON.parse's last-key-wins rule.

export const JSON_LIMITS = Object.freeze({
  maxBytes: 131_072,
  maxDepth: 24,
  maxNodes: 4_096,
  maxKeys: 2_048,
  maxArrayLength: 1_024,
  maxStringLength: 8_192,
  maxTotalStringLength: 65_536,
});

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function limits(overrides = {}) {
  return { ...JSON_LIMITS, ...overrides };
}

function boundaryError(code, detail = "") {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function utf8Length(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw boundaryError("STRICT_JSON_DENIED", "unpaired UTF-16 surrogate");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw boundaryError("STRICT_JSON_DENIED", "unpaired UTF-16 surrogate");
    }
  }
  return Buffer.byteLength(value, "utf8");
}

function accountString(state, value) {
  const bytes = utf8Length(value);
  if (bytes > state.limits.maxStringLength) throw boundaryError("STRICT_JSON_DENIED", "maximum UTF-8 string length exceeded");
  state.stringUnits += bytes;
  if (state.stringUnits > state.limits.maxTotalStringLength) throw boundaryError("STRICT_JSON_DENIED", "maximum total UTF-8 string length exceeded");
}

class Parser {
  constructor(text, configured) {
    this.text = text;
    this.at = 0;
    this.nodes = 0;
    this.stringUnits = 0;
    this.limits = configured;
  }

  fail(detail) {
    throw boundaryError("STRICT_JSON_DENIED", `${detail} at character ${this.at}`);
  }

  whitespace() {
    while (this.at < this.text.length && /[\u0009\u000a\u000d\u0020]/.test(this.text[this.at])) this.at += 1;
  }

  node(depth) {
    if (depth > this.limits.maxDepth) this.fail("maximum depth exceeded");
    this.nodes += 1;
    if (this.nodes > this.limits.maxNodes) this.fail("maximum node count exceeded");
  }

  value(depth) {
    this.whitespace();
    this.node(depth);
    const char = this.text[this.at];
    if (char === "{") return this.object(depth);
    if (char === "[") return this.array(depth);
    if (char === '"') return this.string();
    if (this.text.startsWith("true", this.at)) { this.at += 4; return true; }
    if (this.text.startsWith("false", this.at)) { this.at += 5; return false; }
    if (this.text.startsWith("null", this.at)) { this.at += 4; return null; }
    return this.number();
  }

  string() {
    const start = this.at;
    this.at += 1;
    while (this.at < this.text.length) {
      const code = this.text.charCodeAt(this.at);
      if (code === 0x22) {
        this.at += 1;
        let value;
        try { value = JSON.parse(this.text.slice(start, this.at)); } catch { this.fail("invalid string"); }
        try { accountString(this, value); } catch (error) { this.fail(error.message); }
        return value;
      }
      if (code < 0x20) this.fail("unescaped control character");
      if (code === 0x5c) {
        this.at += 1;
        const escaped = this.text[this.at];
        if (escaped === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(this.text.slice(this.at + 1, this.at + 5))) this.fail("invalid unicode escape");
          this.at += 4;
        } else if (!'"\\/bfnrt'.includes(escaped ?? "")) {
          this.fail("invalid escape");
        }
      }
      this.at += 1;
    }
    this.fail("unterminated string");
  }

  number() {
    const match = this.text.slice(this.at).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (!match) this.fail("invalid value");
    this.at += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value) || Object.is(value, -0)) this.fail("non-finite or negative-zero number");
    return value;
  }

  object(depth) {
    this.at += 1;
    this.whitespace();
    const result = {};
    const keys = new Set();
    if (this.text[this.at] === "}") { this.at += 1; return result; }
    while (true) {
      if (this.text[this.at] !== '"') this.fail("object key must be a string");
      const key = this.string();
      if (DANGEROUS_KEYS.has(key)) this.fail(`dangerous key ${key}`);
      if (keys.has(key)) this.fail(`duplicate key ${key}`);
      keys.add(key);
      this.keys = (this.keys ?? 0) + 1;
      if (this.keys > this.limits.maxKeys) this.fail("maximum object-key count exceeded");
      this.whitespace();
      if (this.text[this.at] !== ":") this.fail("missing colon");
      this.at += 1;
      Object.defineProperty(result, key, {
        value: this.value(depth + 1), enumerable: true, writable: true, configurable: true,
      });
      this.whitespace();
      if (this.text[this.at] === "}") { this.at += 1; return result; }
      if (this.text[this.at] !== ",") this.fail("missing comma");
      this.at += 1;
      this.whitespace();
    }
  }

  array(depth) {
    this.at += 1;
    this.whitespace();
    const result = [];
    if (this.text[this.at] === "]") { this.at += 1; return result; }
    while (true) {
      if (result.length >= this.limits.maxArrayLength) this.fail("maximum array length exceeded");
      result.push(this.value(depth + 1));
      this.whitespace();
      if (this.text[this.at] === "]") { this.at += 1; return result; }
      if (this.text[this.at] !== ",") this.fail("missing comma");
      this.at += 1;
      this.whitespace();
    }
  }

  parse() {
    const result = this.value(0);
    this.whitespace();
    if (this.at !== this.text.length) this.fail("trailing text");
    return result;
  }
}

export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function cloneStrictJson(input, overrides = {}) {
  const configured = limits(overrides);
  const seen = new WeakSet();
  let nodes = 0;
  let stringUnits = 0;
  let keyCount = 0;

  const stringState = { limits: configured, get stringUnits() { return stringUnits; }, set stringUnits(value) { stringUnits = value; } };

  function clone(value, depth) {
    if (depth > configured.maxDepth) throw boundaryError("STRICT_JSON_DENIED", "maximum depth exceeded");
    nodes += 1;
    if (nodes > configured.maxNodes) throw boundaryError("STRICT_JSON_DENIED", "maximum node count exceeded");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || Object.is(value, -0)) throw boundaryError("STRICT_JSON_DENIED", "invalid number");
      return value;
    }
    if (typeof value === "string") {
      accountString(stringState, value);
      return value;
    }
    if (typeof value !== "object") throw boundaryError("STRICT_JSON_DENIED", `unsupported ${typeof value}`);
    if (seen.has(value)) throw boundaryError("STRICT_JSON_DENIED", "cycle or alias detected");
    seen.add(value);
    if (Object.getOwnPropertySymbols(value).length !== 0) throw boundaryError("STRICT_JSON_DENIED", "symbol property detected");

    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) throw boundaryError("STRICT_JSON_DENIED", "non-plain array prototype");
      if (value.length > configured.maxArrayLength) throw boundaryError("STRICT_JSON_DENIED", "maximum array length exceeded");
      const names = Object.getOwnPropertyNames(value);
      const expected = [...Array(value.length).keys()].map(String).concat("length");
      if (names.length !== expected.length || expected.some((name) => !names.includes(name))) {
        throw boundaryError("STRICT_JSON_DENIED", "sparse or augmented array");
      }
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !("value" in descriptor)) throw boundaryError("STRICT_JSON_DENIED", "array accessor or hidden property");
        result.push(clone(descriptor.value, depth + 1));
      }
      return Object.freeze(result);
    }

    if (Object.getPrototypeOf(value) !== Object.prototype) throw boundaryError("STRICT_JSON_DENIED", "non-plain object prototype");
    const names = Object.getOwnPropertyNames(value);
    const keys = Object.keys(value);
    if (names.length !== keys.length) throw boundaryError("STRICT_JSON_DENIED", "non-enumerable property detected");
    const result = {};
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key)) throw boundaryError("STRICT_JSON_DENIED", `dangerous key ${key}`);
      accountString(stringState, key);
      keyCount += 1;
      if (keyCount > configured.maxKeys) throw boundaryError("STRICT_JSON_DENIED", "maximum object-key count exceeded");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) throw boundaryError("STRICT_JSON_DENIED", "accessor property detected");
      Object.defineProperty(result, key, {
        value: clone(descriptor.value, depth + 1), enumerable: true, writable: false, configurable: false,
      });
    }
    return Object.freeze(result);
  }

  const result = clone(input, 0);
  const encoded = Buffer.from(JSON.stringify(result), "utf8");
  if (encoded.length > configured.maxBytes) throw boundaryError("STRICT_JSON_DENIED", "maximum canonical byte length exceeded");
  return result;
}

export function parseStrictJson(bytes, overrides = {}) {
  const configured = limits(overrides);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length > configured.maxBytes) throw boundaryError("STRICT_JSON_DENIED", "maximum byte length exceeded");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { throw boundaryError("STRICT_JSON_DENIED", "invalid UTF-8"); }
  return deepFreeze(new Parser(text, configured).parse());
}
