// build/dev/javascript/prelude.mjs
class CustomType {
  withFields(fields) {
    let properties = Object.keys(this).map((label) => (label in fields) ? fields[label] : this[label]);
    return new this.constructor(...properties);
  }
}

class List {
  static fromArray(array, tail) {
    let t = tail || new Empty;
    for (let i = array.length - 1;i >= 0; --i) {
      t = new NonEmpty(array[i], t);
    }
    return t;
  }
  [Symbol.iterator]() {
    return new ListIterator(this);
  }
  toArray() {
    return [...this];
  }
  atLeastLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return current !== undefined;
  }
  hasLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return desired === -1 && current instanceof Empty;
  }
  countLength() {
    let current = this;
    let length = 0;
    while (current) {
      current = current.tail;
      length++;
    }
    return length - 1;
  }
}
function prepend(element, tail) {
  return new NonEmpty(element, tail);
}
function toList(elements, tail) {
  return List.fromArray(elements, tail);
}

class ListIterator {
  #current;
  constructor(current) {
    this.#current = current;
  }
  next() {
    if (this.#current instanceof Empty) {
      return { done: true };
    } else {
      let { head, tail } = this.#current;
      this.#current = tail;
      return { value: head, done: false };
    }
  }
}

class Empty extends List {
}
var List$Empty = () => new Empty;
var List$isEmpty = (value) => value instanceof Empty;

class NonEmpty extends List {
  constructor(head, tail) {
    super();
    this.head = head;
    this.tail = tail;
  }
}
var List$NonEmpty = (head, tail) => new NonEmpty(head, tail);
var List$isNonEmpty = (value) => value instanceof NonEmpty;
var List$NonEmpty$first = (value) => value.head;
var List$NonEmpty$rest = (value) => value.tail;

class BitArray {
  bitSize;
  byteSize;
  bitOffset;
  rawBuffer;
  constructor(buffer, bitSize, bitOffset) {
    if (!(buffer instanceof Uint8Array)) {
      throw globalThis.Error("BitArray can only be constructed from a Uint8Array");
    }
    this.bitSize = bitSize ?? buffer.length * 8;
    this.byteSize = Math.trunc((this.bitSize + 7) / 8);
    this.bitOffset = bitOffset ?? 0;
    if (this.bitSize < 0) {
      throw globalThis.Error(`BitArray bit size is invalid: ${this.bitSize}`);
    }
    if (this.bitOffset < 0 || this.bitOffset > 7) {
      throw globalThis.Error(`BitArray bit offset is invalid: ${this.bitOffset}`);
    }
    if (buffer.length !== Math.trunc((this.bitOffset + this.bitSize + 7) / 8)) {
      throw globalThis.Error("BitArray buffer length is invalid");
    }
    this.rawBuffer = buffer;
  }
  byteAt(index) {
    if (index < 0 || index >= this.byteSize) {
      return;
    }
    return bitArrayByteAt(this.rawBuffer, this.bitOffset, index);
  }
  equals(other) {
    if (this.bitSize !== other.bitSize) {
      return false;
    }
    const wholeByteCount = Math.trunc(this.bitSize / 8);
    if (this.bitOffset === 0 && other.bitOffset === 0) {
      for (let i = 0;i < wholeByteCount; i++) {
        if (this.rawBuffer[i] !== other.rawBuffer[i]) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (this.rawBuffer[wholeByteCount] >> unusedLowBitCount !== other.rawBuffer[wholeByteCount] >> unusedLowBitCount) {
          return false;
        }
      }
    } else {
      for (let i = 0;i < wholeByteCount; i++) {
        const a = bitArrayByteAt(this.rawBuffer, this.bitOffset, i);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, i);
        if (a !== b) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const a = bitArrayByteAt(this.rawBuffer, this.bitOffset, wholeByteCount);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, wholeByteCount);
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (a >> unusedLowBitCount !== b >> unusedLowBitCount) {
          return false;
        }
      }
    }
    return true;
  }
  get buffer() {
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error("BitArray.buffer does not support unaligned bit arrays");
    }
    return this.rawBuffer;
  }
  get length() {
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error("BitArray.length does not support unaligned bit arrays");
    }
    return this.rawBuffer.length;
  }
}
function bitArrayByteAt(buffer, bitOffset, index) {
  if (bitOffset === 0) {
    return buffer[index] ?? 0;
  } else {
    const a = buffer[index] << bitOffset & 255;
    const b = buffer[index + 1] >> 8 - bitOffset;
    return a | b;
  }
}

class UtfCodepoint {
  constructor(value) {
    this.value = value;
  }
}
class Result extends CustomType {
  static isResult(data2) {
    return data2 instanceof Result;
  }
}

class Ok extends Result {
  constructor(value) {
    super();
    this[0] = value;
  }
  isOk() {
    return true;
  }
}
var Result$Ok = (value) => new Ok(value);
var Result$isOk = (value) => value instanceof Ok;
var Result$Ok$0 = (value) => value[0];

class Error extends Result {
  constructor(detail) {
    super();
    this[0] = detail;
  }
  isOk() {
    return false;
  }
}
var Result$Error = (detail) => new Error(detail);
var Result$isError = (value) => value instanceof Error;
function isEqual(x, y) {
  let values = [x, y];
  while (values.length) {
    let a = values.pop();
    let b = values.pop();
    if (a === b)
      continue;
    if (!isObject(a) || !isObject(b))
      return false;
    let unequal = !structurallyCompatibleObjects(a, b) || unequalDates(a, b) || unequalBuffers(a, b) || unequalArrays(a, b) || unequalMaps(a, b) || unequalSets(a, b) || unequalRegExps(a, b);
    if (unequal)
      return false;
    const proto = Object.getPrototypeOf(a);
    if (proto !== null && typeof proto.equals === "function") {
      try {
        if (a.equals(b))
          continue;
        else
          return false;
      } catch {}
    }
    let [keys, get] = getters(a);
    const ka = keys(a);
    const kb = keys(b);
    if (ka.length !== kb.length)
      return false;
    for (let k of ka) {
      values.push(get(a, k), get(b, k));
    }
  }
  return true;
}
function getters(object) {
  if (object instanceof Map) {
    return [(x) => x.keys(), (x, y) => x.get(y)];
  } else {
    let extra = object instanceof globalThis.Error ? ["message"] : [];
    return [(x) => [...extra, ...Object.keys(x)], (x, y) => x[y]];
  }
}
function unequalDates(a, b) {
  return a instanceof Date && (a > b || a < b);
}
function unequalBuffers(a, b) {
  return !(a instanceof BitArray) && a.buffer instanceof ArrayBuffer && a.BYTES_PER_ELEMENT && !(a.byteLength === b.byteLength && a.every((n, i) => n === b[i]));
}
function unequalArrays(a, b) {
  return Array.isArray(a) && a.length !== b.length;
}
function unequalMaps(a, b) {
  return a instanceof Map && a.size !== b.size;
}
function unequalSets(a, b) {
  return a instanceof Set && (a.size != b.size || [...a].some((e) => !b.has(e)));
}
function unequalRegExps(a, b) {
  return a instanceof RegExp && (a.source !== b.source || a.flags !== b.flags);
}
function isObject(a) {
  return typeof a === "object" && a !== null;
}
function structurallyCompatibleObjects(a, b) {
  if (typeof a !== "object" && typeof b !== "object" && (!a || !b))
    return false;
  let nonstructural = [Promise, WeakSet, WeakMap, Function];
  if (nonstructural.some((c) => a instanceof c))
    return false;
  return a.constructor === b.constructor;
}
function makeError(variant, file, module, line, fn, message, extra) {
  let error = new globalThis.Error(message);
  error.gleam_error = variant;
  error.file = file;
  error.module = module;
  error.line = line;
  error.function = fn;
  error.fn = fn;
  for (let k in extra)
    error[k] = extra[k];
  return error;
}
// build/dev/javascript/gleam_stdlib/dict.mjs
var referenceMap = /* @__PURE__ */ new WeakMap;
var tempDataView = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
var referenceUID = 0;
function hashByReference(o) {
  const known = referenceMap.get(o);
  if (known !== undefined) {
    return known;
  }
  const hash = referenceUID++;
  if (referenceUID === 2147483647) {
    referenceUID = 0;
  }
  referenceMap.set(o, hash);
  return hash;
}
function hashMerge(a, b) {
  return a ^ b + 2654435769 + (a << 6) + (a >> 2) | 0;
}
function hashString(s) {
  let hash = 0;
  const len = s.length;
  for (let i = 0;i < len; i++) {
    hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
  }
  return hash;
}
function hashNumber(n) {
  tempDataView.setFloat64(0, n);
  const i = tempDataView.getInt32(0);
  const j = tempDataView.getInt32(4);
  return Math.imul(73244475, i >> 16 ^ i) ^ j;
}
function hashBigInt(n) {
  return hashString(n.toString());
}
function hashObject(o) {
  const proto = Object.getPrototypeOf(o);
  if (proto !== null && typeof proto.hashCode === "function") {
    try {
      const code = o.hashCode(o);
      if (typeof code === "number") {
        return code;
      }
    } catch {}
  }
  if (o instanceof Promise || o instanceof WeakSet || o instanceof WeakMap) {
    return hashByReference(o);
  }
  if (o instanceof Date) {
    return hashNumber(o.getTime());
  }
  let h = 0;
  if (o instanceof ArrayBuffer) {
    o = new Uint8Array(o);
  }
  if (Array.isArray(o) || o instanceof Uint8Array) {
    for (let i = 0;i < o.length; i++) {
      h = Math.imul(31, h) + getHash(o[i]) | 0;
    }
  } else if (o instanceof Set) {
    o.forEach((v) => {
      h = h + getHash(v) | 0;
    });
  } else if (o instanceof Map) {
    o.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
  } else {
    const keys = Object.keys(o);
    for (let i = 0;i < keys.length; i++) {
      const k = keys[i];
      const v = o[k];
      h = h + hashMerge(getHash(v), hashString(k)) | 0;
    }
  }
  return h;
}
function getHash(u) {
  if (u === null)
    return 1108378658;
  if (u === undefined)
    return 1108378659;
  if (u === true)
    return 1108378657;
  if (u === false)
    return 1108378656;
  switch (typeof u) {
    case "number":
      return hashNumber(u);
    case "string":
      return hashString(u);
    case "bigint":
      return hashBigInt(u);
    case "object":
      return hashObject(u);
    case "symbol":
      return hashByReference(u);
    case "function":
      return hashByReference(u);
    default:
      return 0;
  }
}

class Dict {
  constructor(size, root) {
    this.size = size;
    this.root = root;
  }
}
var bits = 5;
var mask = (1 << bits) - 1;
var noElementMarker = Symbol();
var generationKey = Symbol();
var emptyNode = /* @__PURE__ */ newNode(0);
var emptyDict = /* @__PURE__ */ new Dict(0, emptyNode);
var errorNil = /* @__PURE__ */ Result$Error(undefined);
function makeNode(generation, datamap, nodemap, data2) {
  return {
    datamap,
    nodemap,
    data: data2,
    [generationKey]: generation
  };
}
function newNode(generation) {
  return makeNode(generation, 0, 0, []);
}
function copyNode(node, generation) {
  if (node[generationKey] === generation) {
    return node;
  }
  const newData = node.data.slice(0);
  return makeNode(generation, node.datamap, node.nodemap, newData);
}
function copyAndSet(node, generation, idx, val) {
  if (node.data[idx] === val) {
    return node;
  }
  node = copyNode(node, generation);
  node.data[idx] = val;
  return node;
}
function copyAndInsertPair(node, generation, bit, idx, key, val) {
  const data2 = node.data;
  const length = data2.length;
  const newData = new Array(length + 2);
  let readIndex = 0;
  let writeIndex = 0;
  while (readIndex < idx)
    newData[writeIndex++] = data2[readIndex++];
  newData[writeIndex++] = key;
  newData[writeIndex++] = val;
  while (readIndex < length)
    newData[writeIndex++] = data2[readIndex++];
  return makeNode(generation, node.datamap | bit, node.nodemap, newData);
}
function make() {
  return emptyDict;
}
function get(dict, key) {
  const result = lookup(dict.root, key, getHash(key));
  return result !== noElementMarker ? Result$Ok(result) : errorNil;
}
function lookup(node, key, hash) {
  for (let shift = 0;shift < 32; shift += bits) {
    const data2 = node.data;
    const bit = hashbit(hash, shift);
    if (node.nodemap & bit) {
      node = data2[data2.length - 1 - index(node.nodemap, bit)];
    } else if (node.datamap & bit) {
      const dataidx = Math.imul(index(node.datamap, bit), 2);
      return isEqual(key, data2[dataidx]) ? data2[dataidx + 1] : noElementMarker;
    } else {
      return noElementMarker;
    }
  }
  const overflow = node.data;
  for (let i = 0;i < overflow.length; i += 2) {
    if (isEqual(key, overflow[i])) {
      return overflow[i + 1];
    }
  }
  return noElementMarker;
}
function toTransient(dict) {
  return {
    generation: nextGeneration(dict),
    root: dict.root,
    size: dict.size,
    dict
  };
}
function nextGeneration(dict) {
  const root = dict.root;
  if (root[generationKey] < Number.MAX_SAFE_INTEGER) {
    return root[generationKey] + 1;
  }
  const queue = [root];
  while (queue.length) {
    const node = queue.pop();
    node[generationKey] = 0;
    const nodeStart = data.length - popcount(node.nodemap);
    for (let i = nodeStart;i < node.data.length; ++i) {
      queue.push(node.data[i]);
    }
  }
  return 1;
}
var globalTransient = /* @__PURE__ */ toTransient(emptyDict);
function insert(dict, key, value) {
  globalTransient.generation = nextGeneration(dict);
  globalTransient.size = dict.size;
  const hash = getHash(key);
  const root = insertIntoNode(globalTransient, dict.root, key, value, hash, 0);
  if (root === dict.root) {
    return dict;
  }
  return new Dict(globalTransient.size, root);
}
function insertIntoNode(transient, node, key, value, hash, shift) {
  const data2 = node.data;
  const generation = transient.generation;
  if (shift > 32) {
    for (let i = 0;i < data2.length; i += 2) {
      if (isEqual(key, data2[i])) {
        return copyAndSet(node, generation, i + 1, value);
      }
    }
    transient.size += 1;
    return copyAndInsertPair(node, generation, 0, data2.length, key, value);
  }
  const bit = hashbit(hash, shift);
  if (node.nodemap & bit) {
    const nodeidx2 = data2.length - 1 - index(node.nodemap, bit);
    let child2 = data2[nodeidx2];
    child2 = insertIntoNode(transient, child2, key, value, hash, shift + bits);
    return copyAndSet(node, generation, nodeidx2, child2);
  }
  const dataidx = Math.imul(index(node.datamap, bit), 2);
  if ((node.datamap & bit) === 0) {
    transient.size += 1;
    return copyAndInsertPair(node, generation, bit, dataidx, key, value);
  }
  if (isEqual(key, data2[dataidx])) {
    return copyAndSet(node, generation, dataidx + 1, value);
  }
  const childShift = shift + bits;
  let child = emptyNode;
  child = insertIntoNode(transient, child, key, value, hash, childShift);
  const key2 = data2[dataidx];
  const value2 = data2[dataidx + 1];
  const hash2 = getHash(key2);
  child = insertIntoNode(transient, child, key2, value2, hash2, childShift);
  transient.size -= 1;
  const length = data2.length;
  const nodeidx = length - 1 - index(node.nodemap, bit);
  const newData = new Array(length - 1);
  let readIndex = 0;
  let writeIndex = 0;
  while (readIndex < dataidx)
    newData[writeIndex++] = data2[readIndex++];
  readIndex += 2;
  while (readIndex <= nodeidx)
    newData[writeIndex++] = data2[readIndex++];
  newData[writeIndex++] = child;
  while (readIndex < length)
    newData[writeIndex++] = data2[readIndex++];
  return makeNode(generation, node.datamap ^ bit, node.nodemap | bit, newData);
}
function fold(dict, state, fun) {
  const queue = [dict.root];
  while (queue.length) {
    const node = queue.pop();
    const data2 = node.data;
    const edgesStart = data2.length - popcount(node.nodemap);
    for (let i = 0;i < edgesStart; i += 2) {
      state = fun(state, data2[i], data2[i + 1]);
    }
    for (let i = edgesStart;i < data2.length; ++i) {
      queue.push(data2[i]);
    }
  }
  return state;
}
function popcount(n) {
  n -= n >>> 1 & 1431655765;
  n = (n & 858993459) + (n >>> 2 & 858993459);
  return Math.imul(n + (n >>> 4) & 252645135, 16843009) >>> 24;
}
function index(bitmap, bit) {
  return popcount(bitmap & bit - 1);
}
function hashbit(hash, shift) {
  return 1 << (hash >>> shift & mask);
}

// build/dev/javascript/gleam_stdlib/gleam/option.mjs
class Some extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
var Option$isSome = (value) => value instanceof Some;
var Option$Some$0 = (value) => value[0];

class None extends CustomType {
}

// build/dev/javascript/gleam_stdlib/gleam/dict.mjs
function keys(dict) {
  return fold(dict, toList([]), (acc, key, _) => {
    return prepend(key, acc);
  });
}

// build/dev/javascript/gleam_stdlib/gleam/order.mjs
class Lt extends CustomType {
}
var Order$Lt = () => new Lt;
class Eq extends CustomType {
}
var Order$Eq = () => new Eq;
class Gt extends CustomType {
}
var Order$Gt = () => new Gt;

// build/dev/javascript/gleam_stdlib/gleam/string.mjs
function split2(x, substring) {
  if (substring === "") {
    return graphemes(x);
  } else {
    let _pipe = x;
    let _pipe$1 = identity(_pipe);
    let _pipe$2 = split(_pipe$1, substring);
    return map2(_pipe$2, identity);
  }
}
function concat_loop(loop$strings, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let accumulator = loop$accumulator;
    if (strings instanceof Empty) {
      return accumulator;
    } else {
      let string = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$accumulator = accumulator + string;
    }
  }
}
function concat2(strings) {
  return concat_loop(strings, "");
}
function join_loop(loop$strings, loop$separator, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let separator = loop$separator;
    let accumulator = loop$accumulator;
    if (strings instanceof Empty) {
      return accumulator;
    } else {
      let string = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$separator = separator;
      loop$accumulator = accumulator + separator + string;
    }
  }
}
function join(strings, separator) {
  if (strings instanceof Empty) {
    return "";
  } else {
    let first$1 = strings.head;
    let rest = strings.tail;
    return join_loop(rest, separator, first$1);
  }
}
function trim(string) {
  let _pipe = string;
  let _pipe$1 = trim_start(_pipe);
  return trim_end(_pipe$1);
}

// build/dev/javascript/gleam_stdlib/gleam/dynamic/decode.mjs
class DecodeError extends CustomType {
  constructor(expected, found, path) {
    super();
    this.expected = expected;
    this.found = found;
    this.path = path;
  }
}
var DecodeError$DecodeError = (expected, found, path) => new DecodeError(expected, found, path);
class Decoder extends CustomType {
  constructor(function$) {
    super();
    this.function = function$;
  }
}
var float2 = /* @__PURE__ */ new Decoder(decode_float);
var int2 = /* @__PURE__ */ new Decoder(decode_int);
var string2 = /* @__PURE__ */ new Decoder(decode_string);
function run(data2, decoder) {
  let $ = decoder.function(data2);
  let maybe_invalid_data;
  let errors;
  maybe_invalid_data = $[0];
  errors = $[1];
  if (errors instanceof Empty) {
    return new Ok(maybe_invalid_data);
  } else {
    return new Error(errors);
  }
}
function run_dynamic_function(data2, name, f) {
  let $ = f(data2);
  if ($ instanceof Ok) {
    let data$1 = $[0];
    return [data$1, toList([])];
  } else {
    let placeholder = $[0];
    return [
      placeholder,
      toList([new DecodeError(name, classify_dynamic(data2), toList([]))])
    ];
  }
}
function decode_float(data2) {
  return run_dynamic_function(data2, "Float", float);
}
function map3(decoder, transformer) {
  return new Decoder((d) => {
    let $ = decoder.function(d);
    let data2;
    let errors;
    data2 = $[0];
    errors = $[1];
    return [transformer(data2), errors];
  });
}
function decode_int(data2) {
  return run_dynamic_function(data2, "Int", int);
}
function decode_string(data2) {
  return run_dynamic_function(data2, "String", string);
}
function run_decoders(loop$data, loop$failure, loop$decoders) {
  while (true) {
    let data2 = loop$data;
    let failure = loop$failure;
    let decoders = loop$decoders;
    if (decoders instanceof Empty) {
      return failure;
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder.function(data2);
      let layer;
      let errors;
      layer = $;
      errors = $[1];
      if (errors instanceof Empty) {
        return layer;
      } else {
        loop$data = data2;
        loop$failure = failure;
        loop$decoders = decoders$1;
      }
    }
  }
}
function one_of(first, alternatives) {
  return new Decoder((dynamic_data) => {
    let $ = first.function(dynamic_data);
    let layer;
    let errors;
    layer = $;
    errors = $[1];
    if (errors instanceof Empty) {
      return layer;
    } else {
      return run_decoders(dynamic_data, layer, alternatives);
    }
  });
}
function path_segment_to_string(key) {
  let decoder = one_of(string2, toList([
    (() => {
      let _pipe = int2;
      return map3(_pipe, to_string);
    })(),
    (() => {
      let _pipe = float2;
      return map3(_pipe, float_to_string);
    })()
  ]));
  let $ = run(key, decoder);
  if ($ instanceof Ok) {
    let key$1 = $[0];
    return key$1;
  } else {
    return "<" + classify_dynamic(key) + ">";
  }
}
function push_path(layer, path) {
  let path$1 = map2(path, (key) => {
    let _pipe = key;
    let _pipe$1 = identity(_pipe);
    return path_segment_to_string(_pipe$1);
  });
  let errors = map2(layer[1], (error) => {
    return new DecodeError(error.expected, error.found, append2(path$1, error.path));
  });
  return [layer[0], errors];
}
function list2(inner) {
  return new Decoder((data2) => {
    return list(data2, inner.function, (p, k) => {
      return push_path(p, toList([k]));
    }, 0, toList([]));
  });
}
function index3(loop$path, loop$position, loop$inner, loop$data, loop$handle_miss) {
  while (true) {
    let path = loop$path;
    let position = loop$position;
    let inner = loop$inner;
    let data2 = loop$data;
    let handle_miss = loop$handle_miss;
    if (path instanceof Empty) {
      let _pipe = data2;
      let _pipe$1 = inner(_pipe);
      return push_path(_pipe$1, reverse(position));
    } else {
      let key = path.head;
      let path$1 = path.tail;
      let $ = index2(data2, key);
      if ($ instanceof Ok) {
        let $1 = $[0];
        if ($1 instanceof Some) {
          let data$1 = $1[0];
          loop$path = path$1;
          loop$position = prepend(key, position);
          loop$inner = inner;
          loop$data = data$1;
          loop$handle_miss = handle_miss;
        } else {
          return handle_miss(data2, prepend(key, position));
        }
      } else {
        let kind = $[0];
        let $1 = inner(data2);
        let default$;
        default$ = $1[0];
        let _pipe = [
          default$,
          toList([new DecodeError(kind, classify_dynamic(data2), toList([]))])
        ];
        return push_path(_pipe, reverse(position));
      }
    }
  }
}
function subfield(field_path, field_decoder, next) {
  return new Decoder((data2) => {
    let $ = index3(field_path, toList([]), field_decoder.function, data2, (data3, position) => {
      let $12 = field_decoder.function(data3);
      let default$;
      default$ = $12[0];
      let _pipe = [
        default$,
        toList([new DecodeError("Field", "Nothing", toList([]))])
      ];
      return push_path(_pipe, reverse(position));
    });
    let out;
    let errors1;
    out = $[0];
    errors1 = $[1];
    let $1 = next(out).function(data2);
    let out$1;
    let errors2;
    out$1 = $1[0];
    errors2 = $1[1];
    return [out$1, append2(errors1, errors2)];
  });
}
function success(data2) {
  return new Decoder((_) => {
    return [data2, toList([])];
  });
}
function field(field_name, field_decoder, next) {
  return subfield(toList([field_name]), field_decoder, next);
}

// build/dev/javascript/gleam_stdlib/gleam_stdlib.mjs
function identity(x) {
  return x;
}
function to_string(term) {
  return term.toString();
}
function graphemes(string3) {
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    return arrayToList(Array.from(iterator).map((item) => item.segment));
  } else {
    return arrayToList(string3.match(/./gsu));
  }
}
var segmenter = undefined;
function graphemes_iterator(string3) {
  if (globalThis.Intl && Intl.Segmenter) {
    segmenter ||= new Intl.Segmenter;
    return segmenter.segment(string3)[Symbol.iterator]();
  }
}
function split(xs, pattern) {
  return arrayToList(xs.split(pattern));
}
function starts_with(haystack, needle) {
  return haystack.startsWith(needle);
}
var unicode_whitespaces = [
  " ",
  "\t",
  `
`,
  "\v",
  "\f",
  "\r",
  "",
  "\u2028",
  "\u2029"
].join("");
var trim_start_regex = /* @__PURE__ */ new RegExp(`^[${unicode_whitespaces}]*`);
var trim_end_regex = /* @__PURE__ */ new RegExp(`[${unicode_whitespaces}]*$`);
function trim_start(string3) {
  return string3.replace(trim_start_regex, "");
}
function trim_end(string3) {
  return string3.replace(trim_end_regex, "");
}
function classify_dynamic(data2) {
  if (typeof data2 === "string") {
    return "String";
  } else if (typeof data2 === "boolean") {
    return "Bool";
  } else if (isResult(data2)) {
    return "Result";
  } else if (isList(data2)) {
    return "List";
  } else if (data2 instanceof BitArray) {
    return "BitArray";
  } else if (data2 instanceof Dict) {
    return "Dict";
  } else if (Number.isInteger(data2)) {
    return "Int";
  } else if (Array.isArray(data2)) {
    return `Array`;
  } else if (typeof data2 === "number") {
    return "Float";
  } else if (data2 === null) {
    return "Nil";
  } else if (data2 === undefined) {
    return "Nil";
  } else {
    const type = typeof data2;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
var MIN_I32 = -(2 ** 31);
var MAX_I32 = 2 ** 31 - 1;
var U32 = 2 ** 32;
var MAX_SAFE = Number.MAX_SAFE_INTEGER;
var MIN_SAFE = Number.MIN_SAFE_INTEGER;
function float_to_string(float3) {
  const string3 = float3.toString().replace("+", "");
  if (string3.indexOf(".") >= 0) {
    return string3;
  } else {
    const index4 = string3.indexOf("e");
    if (index4 >= 0) {
      return string3.slice(0, index4) + ".0" + string3.slice(index4);
    } else {
      return string3 + ".0";
    }
  }
}

class Inspector {
  #references = new Set;
  inspect(v) {
    const t = typeof v;
    if (v === true)
      return "True";
    if (v === false)
      return "False";
    if (v === null)
      return "//js(null)";
    if (v === undefined)
      return "Nil";
    if (t === "string")
      return this.#string(v);
    if (t === "bigint" || Number.isInteger(v))
      return v.toString();
    if (t === "number")
      return float_to_string(v);
    if (v instanceof UtfCodepoint)
      return this.#utfCodepoint(v);
    if (v instanceof BitArray)
      return this.#bit_array(v);
    if (v instanceof RegExp)
      return `//js(${v})`;
    if (v instanceof Date)
      return `//js(Date("${v.toISOString()}"))`;
    if (v instanceof globalThis.Error)
      return `//js(${v.toString()})`;
    if (v instanceof Function) {
      const args = [];
      for (const i of Array(v.length).keys())
        args.push(String.fromCharCode(i + 97));
      return `//fn(${args.join(", ")}) { ... }`;
    }
    if (this.#references.size === this.#references.add(v).size) {
      return "//js(circular reference)";
    }
    let printed;
    if (Array.isArray(v)) {
      printed = `#(${v.map((v2) => this.inspect(v2)).join(", ")})`;
    } else if (isList(v)) {
      printed = this.#list(v);
    } else if (v instanceof CustomType) {
      printed = this.#customType(v);
    } else if (v instanceof Dict) {
      printed = this.#dict(v);
    } else if (v instanceof Set) {
      return `//js(Set(${[...v].map((v2) => this.inspect(v2)).join(", ")}))`;
    } else {
      printed = this.#object(v);
    }
    this.#references.delete(v);
    return printed;
  }
  #object(v) {
    const name = Object.getPrototypeOf(v)?.constructor?.name || "Object";
    const props = [];
    for (const k of Object.keys(v)) {
      props.push(`${this.inspect(k)}: ${this.inspect(v[k])}`);
    }
    const body = props.length ? " " + props.join(", ") + " " : "";
    const head = name === "Object" ? "" : name + " ";
    return `//js(${head}{${body}})`;
  }
  #dict(map4) {
    let body = "dict.from_list([";
    let first = true;
    body = fold(map4, body, (body2, key, value) => {
      if (!first)
        body2 = body2 + ", ";
      first = false;
      return body2 + "#(" + this.inspect(key) + ", " + this.inspect(value) + ")";
    });
    return body + "])";
  }
  #customType(record) {
    const props = Object.keys(record).map((label) => {
      const value = this.inspect(record[label]);
      return isNaN(parseInt(label)) ? `${label}: ${value}` : value;
    }).join(", ");
    return props ? `${record.constructor.name}(${props})` : record.constructor.name;
  }
  #list(list3) {
    if (List$isEmpty(list3)) {
      return "[]";
    }
    let char_out = 'charlist.from_string("';
    let list_out = "[";
    let current = list3;
    while (List$isNonEmpty(current)) {
      let element = current.head;
      current = current.tail;
      if (list_out !== "[") {
        list_out += ", ";
      }
      list_out += this.inspect(element);
      if (char_out) {
        if (Number.isInteger(element) && element >= 32 && element <= 126) {
          char_out += String.fromCharCode(element);
        } else {
          char_out = null;
        }
      }
    }
    if (char_out) {
      return char_out + '")';
    } else {
      return list_out + "]";
    }
  }
  #string(str) {
    let new_str = '"';
    for (let i = 0;i < str.length; i++) {
      const char = str[i];
      switch (char) {
        case `
`:
          new_str += "\\n";
          break;
        case "\r":
          new_str += "\\r";
          break;
        case "\t":
          new_str += "\\t";
          break;
        case "\f":
          new_str += "\\f";
          break;
        case "\\":
          new_str += "\\\\";
          break;
        case '"':
          new_str += "\\\"";
          break;
        default:
          if (char < " " || char > "~" && char < " ") {
            new_str += "\\u{" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "}";
          } else {
            new_str += char;
          }
      }
    }
    new_str += '"';
    return new_str;
  }
  #utfCodepoint(codepoint2) {
    return `//utfcodepoint(${String.fromCodePoint(codepoint2.value)})`;
  }
  #bit_array(bits2) {
    if (bits2.bitSize === 0) {
      return "<<>>";
    }
    let acc = "<<";
    for (let i = 0;i < bits2.byteSize - 1; i++) {
      acc += bits2.byteAt(i).toString();
      acc += ", ";
    }
    if (bits2.byteSize * 8 === bits2.bitSize) {
      acc += bits2.byteAt(bits2.byteSize - 1).toString();
    } else {
      const trailingBitsCount = bits2.bitSize % 8;
      acc += bits2.byteAt(bits2.byteSize - 1) >> 8 - trailingBitsCount;
      acc += `:size(${trailingBitsCount})`;
    }
    acc += ">>";
    return acc;
  }
}
function index2(data2, key) {
  if (data2 instanceof Dict) {
    const result = get(data2, key);
    return Result$Ok(result.isOk() ? new Some(result[0]) : new None);
  }
  if (data2 instanceof WeakMap || data2 instanceof Map) {
    const token = {};
    const entry = data2.get(key, token);
    if (entry === token)
      return Result$Ok(new None);
    return Result$Ok(new Some(entry));
  }
  const key_is_int = Number.isInteger(key);
  if (key_is_int && key >= 0 && key < 8 && isList(data2)) {
    let i = 0;
    for (const value of data2) {
      if (i === key)
        return Result$Ok(new Some(value));
      i++;
    }
    return Result$Error("Indexable");
  }
  if (key_is_int && Array.isArray(data2) || data2 && typeof data2 === "object" || data2 && Object.getPrototypeOf(data2) === Object.prototype) {
    if (key in data2)
      return Result$Ok(new Some(data2[key]));
    return Result$Ok(new None);
  }
  return Result$Error(key_is_int ? "Indexable" : "Dict");
}
function list(data2, decode, pushPath, index4, emptyList) {
  if (!(isList(data2) || Array.isArray(data2))) {
    const error = DecodeError$DecodeError("List", classify_dynamic(data2), emptyList);
    return [emptyList, arrayToList([error])];
  }
  const decoded = [];
  for (const element of data2) {
    const layer = decode(element);
    const [out, errors] = layer;
    if (List$isNonEmpty(errors)) {
      const [_, errors2] = pushPath(layer, index4.toString());
      return [emptyList, errors2];
    }
    decoded.push(out);
    index4++;
  }
  return [arrayToList(decoded), emptyList];
}
function float(data2) {
  if (typeof data2 === "number")
    return Result$Ok(data2);
  return Result$Error(0);
}
function int(data2) {
  if (Number.isInteger(data2))
    return Result$Ok(data2);
  return Result$Error(0);
}
function string(data2) {
  if (typeof data2 === "string")
    return Result$Ok(data2);
  return Result$Error("");
}
function arrayToList(array) {
  let list3 = List$Empty();
  let i = array.length;
  while (i--) {
    list3 = List$NonEmpty(array[i], list3);
  }
  return list3;
}
function isList(data2) {
  return List$isEmpty(data2) || List$isNonEmpty(data2);
}
function isResult(data2) {
  return Result$isOk(data2) || Result$isError(data2);
}

// build/dev/javascript/gleam_stdlib/gleam/list.mjs
class Ascending extends CustomType {
}

class Descending extends CustomType {
}
function reverse_and_prepend(loop$prefix, loop$suffix) {
  while (true) {
    let prefix = loop$prefix;
    let suffix = loop$suffix;
    if (prefix instanceof Empty) {
      return suffix;
    } else {
      let first$1 = prefix.head;
      let rest$1 = prefix.tail;
      loop$prefix = rest$1;
      loop$suffix = prepend(first$1, suffix);
    }
  }
}
function reverse(list3) {
  return reverse_and_prepend(list3, toList([]));
}
function filter_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list3 instanceof Empty) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let _block;
      let $ = fun(first$1);
      if ($) {
        _block = prepend(first$1, acc);
      } else {
        _block = acc;
      }
      let new_acc = _block;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter(list3, predicate) {
  return filter_loop(list3, predicate, toList([]));
}
function map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list3 instanceof Empty) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = prepend(fun(first$1), acc);
    }
  }
}
function map2(list3, fun) {
  return map_loop(list3, fun, toList([]));
}
function append_loop(loop$first, loop$second) {
  while (true) {
    let first = loop$first;
    let second = loop$second;
    if (first instanceof Empty) {
      return second;
    } else {
      let first$1 = first.head;
      let rest$1 = first.tail;
      loop$first = rest$1;
      loop$second = prepend(first$1, second);
    }
  }
}
function append2(first, second) {
  return append_loop(reverse(first), second);
}
function prepend2(list3, item) {
  return prepend(item, list3);
}
function fold2(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list3 = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list3 instanceof Empty) {
      return initial;
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$initial = fun(initial, first$1);
      loop$fun = fun;
    }
  }
}
function any(loop$list, loop$predicate) {
  while (true) {
    let list3 = loop$list;
    let predicate = loop$predicate;
    if (list3 instanceof Empty) {
      return false;
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let $ = predicate(first$1);
      if ($) {
        return $;
      } else {
        loop$list = rest$1;
        loop$predicate = predicate;
      }
    }
  }
}
function merge_descendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list22 = loop$list2;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (list1 instanceof Empty) {
      let list3 = list22;
      return reverse_and_prepend(list3, acc);
    } else if (list22 instanceof Empty) {
      let list3 = list1;
      return reverse_and_prepend(list3, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list22.head;
      let rest2 = list22.tail;
      let $ = compare2(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare2;
        loop$acc = prepend(first2, acc);
      } else if ($ instanceof Eq) {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare2;
        loop$acc = prepend(first1, acc);
      } else {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare2;
        loop$acc = prepend(first1, acc);
      }
    }
  }
}
function merge_descending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences = loop$sequences;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (sequences instanceof Empty) {
      return reverse(acc);
    } else {
      let $ = sequences.tail;
      if ($ instanceof Empty) {
        let sequence = sequences.head;
        return reverse(prepend(reverse(sequence), acc));
      } else {
        let descending1 = sequences.head;
        let descending2 = $.head;
        let rest$1 = $.tail;
        let ascending = merge_descendings(descending1, descending2, compare2, toList([]));
        loop$sequences = rest$1;
        loop$compare = compare2;
        loop$acc = prepend(ascending, acc);
      }
    }
  }
}
function merge_ascendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list22 = loop$list2;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (list1 instanceof Empty) {
      let list3 = list22;
      return reverse_and_prepend(list3, acc);
    } else if (list22 instanceof Empty) {
      let list3 = list1;
      return reverse_and_prepend(list3, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list22.head;
      let rest2 = list22.tail;
      let $ = compare2(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare2;
        loop$acc = prepend(first1, acc);
      } else if ($ instanceof Eq) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare2;
        loop$acc = prepend(first2, acc);
      } else {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare2;
        loop$acc = prepend(first2, acc);
      }
    }
  }
}
function merge_ascending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences = loop$sequences;
    let compare2 = loop$compare;
    let acc = loop$acc;
    if (sequences instanceof Empty) {
      return reverse(acc);
    } else {
      let $ = sequences.tail;
      if ($ instanceof Empty) {
        let sequence = sequences.head;
        return reverse(prepend(reverse(sequence), acc));
      } else {
        let ascending1 = sequences.head;
        let ascending2 = $.head;
        let rest$1 = $.tail;
        let descending = merge_ascendings(ascending1, ascending2, compare2, toList([]));
        loop$sequences = rest$1;
        loop$compare = compare2;
        loop$acc = prepend(descending, acc);
      }
    }
  }
}
function merge_all(loop$sequences, loop$direction, loop$compare) {
  while (true) {
    let sequences = loop$sequences;
    let direction = loop$direction;
    let compare2 = loop$compare;
    if (sequences instanceof Empty) {
      return sequences;
    } else if (direction instanceof Ascending) {
      let $ = sequences.tail;
      if ($ instanceof Empty) {
        let sequence = sequences.head;
        return sequence;
      } else {
        let sequences$1 = merge_ascending_pairs(sequences, compare2, toList([]));
        loop$sequences = sequences$1;
        loop$direction = new Descending;
        loop$compare = compare2;
      }
    } else {
      let $ = sequences.tail;
      if ($ instanceof Empty) {
        let sequence = sequences.head;
        return reverse(sequence);
      } else {
        let sequences$1 = merge_descending_pairs(sequences, compare2, toList([]));
        loop$sequences = sequences$1;
        loop$direction = new Ascending;
        loop$compare = compare2;
      }
    }
  }
}
function sequences(loop$list, loop$compare, loop$growing, loop$direction, loop$prev, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let compare2 = loop$compare;
    let growing = loop$growing;
    let direction = loop$direction;
    let prev = loop$prev;
    let acc = loop$acc;
    let growing$1 = prepend(prev, growing);
    if (list3 instanceof Empty) {
      if (direction instanceof Ascending) {
        return prepend(reverse(growing$1), acc);
      } else {
        return prepend(growing$1, acc);
      }
    } else {
      let new$1 = list3.head;
      let rest$1 = list3.tail;
      let $ = compare2(prev, new$1);
      if (direction instanceof Ascending) {
        if ($ instanceof Lt) {
          loop$list = rest$1;
          loop$compare = compare2;
          loop$growing = growing$1;
          loop$direction = direction;
          loop$prev = new$1;
          loop$acc = acc;
        } else if ($ instanceof Eq) {
          loop$list = rest$1;
          loop$compare = compare2;
          loop$growing = growing$1;
          loop$direction = direction;
          loop$prev = new$1;
          loop$acc = acc;
        } else {
          let _block;
          if (direction instanceof Ascending) {
            _block = prepend(reverse(growing$1), acc);
          } else {
            _block = prepend(growing$1, acc);
          }
          let acc$1 = _block;
          if (rest$1 instanceof Empty) {
            return prepend(toList([new$1]), acc$1);
          } else {
            let next = rest$1.head;
            let rest$2 = rest$1.tail;
            let _block$1;
            let $1 = compare2(new$1, next);
            if ($1 instanceof Lt) {
              _block$1 = new Ascending;
            } else if ($1 instanceof Eq) {
              _block$1 = new Ascending;
            } else {
              _block$1 = new Descending;
            }
            let direction$1 = _block$1;
            loop$list = rest$2;
            loop$compare = compare2;
            loop$growing = toList([new$1]);
            loop$direction = direction$1;
            loop$prev = next;
            loop$acc = acc$1;
          }
        }
      } else if ($ instanceof Lt) {
        let _block;
        if (direction instanceof Ascending) {
          _block = prepend(reverse(growing$1), acc);
        } else {
          _block = prepend(growing$1, acc);
        }
        let acc$1 = _block;
        if (rest$1 instanceof Empty) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let _block$1;
          let $1 = compare2(new$1, next);
          if ($1 instanceof Lt) {
            _block$1 = new Ascending;
          } else if ($1 instanceof Eq) {
            _block$1 = new Ascending;
          } else {
            _block$1 = new Descending;
          }
          let direction$1 = _block$1;
          loop$list = rest$2;
          loop$compare = compare2;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else if ($ instanceof Eq) {
        let _block;
        if (direction instanceof Ascending) {
          _block = prepend(reverse(growing$1), acc);
        } else {
          _block = prepend(growing$1, acc);
        }
        let acc$1 = _block;
        if (rest$1 instanceof Empty) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let _block$1;
          let $1 = compare2(new$1, next);
          if ($1 instanceof Lt) {
            _block$1 = new Ascending;
          } else if ($1 instanceof Eq) {
            _block$1 = new Ascending;
          } else {
            _block$1 = new Descending;
          }
          let direction$1 = _block$1;
          loop$list = rest$2;
          loop$compare = compare2;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else {
        loop$list = rest$1;
        loop$compare = compare2;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      }
    }
  }
}
function sort(list3, compare2) {
  if (list3 instanceof Empty) {
    return list3;
  } else {
    let $ = list3.tail;
    if ($ instanceof Empty) {
      return list3;
    } else {
      let x = list3.head;
      let y = $.head;
      let rest$1 = $.tail;
      let _block;
      let $1 = compare2(x, y);
      if ($1 instanceof Lt) {
        _block = new Ascending;
      } else if ($1 instanceof Eq) {
        _block = new Ascending;
      } else {
        _block = new Descending;
      }
      let direction = _block;
      let sequences$1 = sequences(rest$1, compare2, toList([x]), direction, y, toList([]));
      return merge_all(sequences$1, new Ascending, compare2);
    }
  }
}
function each(loop$list, loop$f) {
  while (true) {
    let list3 = loop$list;
    let f = loop$f;
    if (list3 instanceof Empty) {
      return;
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      f(first$1);
      loop$list = rest$1;
      loop$f = f;
    }
  }
}
// build/dev/javascript/gleam_stdlib/gleam/result.mjs
function map_error(result, fun) {
  if (result instanceof Ok) {
    return result;
  } else {
    let error = result[0];
    return new Error(fun(error));
  }
}
function try$(result, fun) {
  if (result instanceof Ok) {
    let x = result[0];
    return fun(x);
  } else {
    return result;
  }
}
// build/dev/javascript/gleam_stdlib/gleam/bool.mjs
function guard(requirement, consequence, alternative) {
  if (requirement) {
    return consequence;
  } else {
    return alternative();
  }
}

// build/dev/javascript/gleam_stdlib/gleam/function.mjs
function identity2(x) {
  return x;
}
// build/dev/javascript/gleam_json/gleam_json_ffi.mjs
function json_to_string(json) {
  return JSON.stringify(json);
}
function object(entries) {
  return Object.fromEntries(entries);
}
function identity3(x) {
  return x;
}
function decode(string3) {
  try {
    const result = JSON.parse(string3);
    return Result$Ok(result);
  } catch (err) {
    return Result$Error(getJsonDecodeError(err, string3));
  }
}
function getJsonDecodeError(stdErr, json) {
  if (isUnexpectedEndOfInput(stdErr))
    return DecodeError$UnexpectedEndOfInput();
  return toUnexpectedByteError(stdErr, json);
}
function isUnexpectedEndOfInput(err) {
  const unexpectedEndOfInputRegex = /((unexpected (end|eof))|(end of data)|(unterminated string)|(json( parse error|\.parse)\: expected '(\:|\}|\])'))/i;
  return unexpectedEndOfInputRegex.test(err.message);
}
function toUnexpectedByteError(err, json) {
  let converters = [
    v8UnexpectedByteError,
    oldV8UnexpectedByteError,
    jsCoreUnexpectedByteError,
    spidermonkeyUnexpectedByteError
  ];
  for (let converter of converters) {
    let result = converter(err, json);
    if (result)
      return result;
  }
  return DecodeError$UnexpectedByte("");
}
function v8UnexpectedByteError(err) {
  const regex = /unexpected token '(.)', ".+" is not valid JSON/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  return DecodeError$UnexpectedByte(byte);
}
function oldV8UnexpectedByteError(err) {
  const regex = /unexpected token (.) in JSON at position (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  return DecodeError$UnexpectedByte(byte);
}
function spidermonkeyUnexpectedByteError(err, json) {
  const regex = /(unexpected character|expected .*) at line (\d+) column (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const line = Number(match[2]);
  const column = Number(match[3]);
  const position = getPositionFromMultiline(line, column, json);
  const byte = toHex(json[position]);
  return DecodeError$UnexpectedByte(byte);
}
function jsCoreUnexpectedByteError(err) {
  const regex = /unexpected (identifier|token) "(.)"/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[2]);
  return DecodeError$UnexpectedByte(byte);
}
function toHex(char) {
  return "0x" + char.charCodeAt(0).toString(16).toUpperCase();
}
function getPositionFromMultiline(line, column, string3) {
  if (line === 1)
    return column - 1;
  let currentLn = 1;
  let position = 0;
  string3.split("").find((char, idx) => {
    if (char === `
`)
      currentLn += 1;
    if (currentLn === line) {
      position = idx + column;
      return true;
    }
    return false;
  });
  return position;
}

// build/dev/javascript/gleam_json/gleam/json.mjs
class UnexpectedEndOfInput extends CustomType {
}
var DecodeError$UnexpectedEndOfInput = () => new UnexpectedEndOfInput;
class UnexpectedByte extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
var DecodeError$UnexpectedByte = ($0) => new UnexpectedByte($0);
class UnableToDecode extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
function do_parse(json, decoder) {
  return try$(decode(json), (dynamic_value) => {
    let _pipe = run(dynamic_value, decoder);
    return map_error(_pipe, (var0) => {
      return new UnableToDecode(var0);
    });
  });
}
function parse(json, decoder) {
  return do_parse(json, decoder);
}
function to_string2(json) {
  return json_to_string(json);
}
function string3(input) {
  return identity3(input);
}
function object2(entries) {
  return object(entries);
}
// build/dev/javascript/houdini/houdini.ffi.mjs
function escape(string4) {
  return string4.replaceAll(/[><&"']/g, (replaced) => {
    switch (replaced) {
      case ">":
        return "&gt;";
      case "<":
        return "&lt;";
      case "'":
        return "&#39;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return replaced;
    }
  });
}

// build/dev/javascript/lustre/lustre/internals/constants.mjs
var empty_list = /* @__PURE__ */ toList([]);
var error_nil = /* @__PURE__ */ new Error(undefined);
function singleton_list(item) {
  return prepend(item, empty_list);
}

// build/dev/javascript/lustre/lustre/vdom/vattr.ffi.mjs
var GT = /* @__PURE__ */ Order$Gt();
var LT = /* @__PURE__ */ Order$Lt();
var EQ = /* @__PURE__ */ Order$Eq();
function compare2(a, b) {
  if (a.name === b.name) {
    return EQ;
  } else if (a.name < b.name) {
    return LT;
  } else {
    return GT;
  }
}

// build/dev/javascript/lustre/lustre/vdom/vattr.mjs
class Attribute extends CustomType {
  constructor(kind, name, value) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value;
  }
}
class Property extends CustomType {
  constructor(kind, name, value) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value;
  }
}
class Event2 extends CustomType {
  constructor(kind, name, handler, include, prevent_default, stop_propagation, debounce, throttle) {
    super();
    this.kind = kind;
    this.name = name;
    this.handler = handler;
    this.include = include;
    this.prevent_default = prevent_default;
    this.stop_propagation = stop_propagation;
    this.debounce = debounce;
    this.throttle = throttle;
  }
}
class Handler extends CustomType {
  constructor(prevent_default, stop_propagation, message) {
    super();
    this.prevent_default = prevent_default;
    this.stop_propagation = stop_propagation;
    this.message = message;
  }
}
class Never extends CustomType {
  constructor(kind) {
    super();
    this.kind = kind;
  }
}
var attribute_kind = 0;
var property_kind = 1;
var event_kind = 2;
var never_kind = 0;
var never = /* @__PURE__ */ new Never(never_kind);
var always_kind = 2;
function attribute(name, value) {
  return new Attribute(attribute_kind, name, value);
}
function event(name, handler, include, prevent_default, stop_propagation, debounce, throttle) {
  return new Event2(event_kind, name, handler, include, prevent_default, stop_propagation, debounce, throttle);
}
function merge(loop$attributes, loop$merged) {
  while (true) {
    let attributes = loop$attributes;
    let merged = loop$merged;
    if (attributes instanceof Empty) {
      return merged;
    } else {
      let $ = attributes.head;
      if ($ instanceof Attribute) {
        let $1 = $.name;
        if ($1 === "") {
          let rest = attributes.tail;
          loop$attributes = rest;
          loop$merged = merged;
        } else if ($1 === "class") {
          let $2 = $.value;
          if ($2 === "") {
            let rest = attributes.tail;
            loop$attributes = rest;
            loop$merged = merged;
          } else {
            let $3 = attributes.tail;
            if ($3 instanceof Empty) {
              let attribute$1 = $;
              let rest = $3;
              loop$attributes = rest;
              loop$merged = prepend(attribute$1, merged);
            } else {
              let $4 = $3.head;
              if ($4 instanceof Attribute) {
                let $5 = $4.name;
                if ($5 === "class") {
                  let kind = $.kind;
                  let class1 = $2;
                  let rest = $3.tail;
                  let class2 = $4.value;
                  let value = class1 + " " + class2;
                  let attribute$1 = new Attribute(kind, "class", value);
                  loop$attributes = prepend(attribute$1, rest);
                  loop$merged = merged;
                } else {
                  let attribute$1 = $;
                  let rest = $3;
                  loop$attributes = rest;
                  loop$merged = prepend(attribute$1, merged);
                }
              } else {
                let attribute$1 = $;
                let rest = $3;
                loop$attributes = rest;
                loop$merged = prepend(attribute$1, merged);
              }
            }
          }
        } else if ($1 === "style") {
          let $2 = $.value;
          if ($2 === "") {
            let rest = attributes.tail;
            loop$attributes = rest;
            loop$merged = merged;
          } else {
            let $3 = attributes.tail;
            if ($3 instanceof Empty) {
              let attribute$1 = $;
              let rest = $3;
              loop$attributes = rest;
              loop$merged = prepend(attribute$1, merged);
            } else {
              let $4 = $3.head;
              if ($4 instanceof Attribute) {
                let $5 = $4.name;
                if ($5 === "style") {
                  let kind = $.kind;
                  let style1 = $2;
                  let rest = $3.tail;
                  let style2 = $4.value;
                  let value = style1 + ";" + style2;
                  let attribute$1 = new Attribute(kind, "style", value);
                  loop$attributes = prepend(attribute$1, rest);
                  loop$merged = merged;
                } else {
                  let attribute$1 = $;
                  let rest = $3;
                  loop$attributes = rest;
                  loop$merged = prepend(attribute$1, merged);
                }
              } else {
                let attribute$1 = $;
                let rest = $3;
                loop$attributes = rest;
                loop$merged = prepend(attribute$1, merged);
              }
            }
          }
        } else {
          let attribute$1 = $;
          let rest = attributes.tail;
          loop$attributes = rest;
          loop$merged = prepend(attribute$1, merged);
        }
      } else {
        let attribute$1 = $;
        let rest = attributes.tail;
        loop$attributes = rest;
        loop$merged = prepend(attribute$1, merged);
      }
    }
  }
}
function prepare(attributes) {
  if (attributes instanceof Empty) {
    return attributes;
  } else {
    let $ = attributes.tail;
    if ($ instanceof Empty) {
      return attributes;
    } else {
      let _pipe = attributes;
      let _pipe$1 = sort(_pipe, (a, b) => {
        return compare2(b, a);
      });
      return merge(_pipe$1, empty_list);
    }
  }
}

// build/dev/javascript/lustre/lustre/attribute.mjs
function attribute2(name, value) {
  return attribute(name, value);
}
function class$(name) {
  return attribute2("class", name);
}
function data2(key, value) {
  return attribute2("data-" + key, value);
}
function id(value) {
  return attribute2("id", value);
}
function autocomplete(value) {
  return attribute2("autocomplete", value);
}
function for$(id2) {
  return attribute2("for", id2);
}
function maxlength(length2) {
  return attribute2("maxlength", to_string(length2));
}
function type_(control_type) {
  return attribute2("type", control_type);
}
function value(control_value) {
  return attribute2("value", control_value);
}

// build/dev/javascript/lustre/lustre/effect.mjs
class Effect extends CustomType {
  constructor(synchronous, before_paint, after_paint) {
    super();
    this.synchronous = synchronous;
    this.before_paint = before_paint;
    this.after_paint = after_paint;
  }
}

class Actions extends CustomType {
  constructor(dispatch, emit, select, root, provide, subscribe, unsubscribe) {
    super();
    this.dispatch = dispatch;
    this.emit = emit;
    this.select = select;
    this.root = root;
    this.provide = provide;
    this.subscribe = subscribe;
    this.unsubscribe = unsubscribe;
  }
}
var empty = /* @__PURE__ */ new Effect(empty_list, empty_list, empty_list);
function none() {
  return empty;
}
function from2(effect) {
  let task = (actions) => {
    let dispatch = actions.dispatch;
    return effect(dispatch);
  };
  return new Effect(singleton_list(task), empty.before_paint, empty.after_paint);
}
function batch(effects) {
  return fold2(effects, empty, (acc, eff) => {
    return new Effect(fold2(eff.synchronous, acc.synchronous, prepend2), fold2(eff.before_paint, acc.before_paint, prepend2), fold2(eff.after_paint, acc.after_paint, prepend2));
  });
}
function perform(effect, dispatch, emit, select, root, provide, subscribe, unsubscribe) {
  let actions = new Actions(dispatch, emit, select, root, provide, subscribe, unsubscribe);
  return each(effect.synchronous, (run2) => {
    return run2(actions);
  });
}

// build/dev/javascript/lustre/lustre/internals/mutable_map.ffi.mjs
function empty2() {
  return null;
}
function get2(map4, key) {
  return map4?.get(key);
}
function get_or_compute(map4, key, compute) {
  return map4?.get(key) ?? compute();
}
function has_key(map4, key) {
  return map4 && map4.has(key);
}
function insert2(map4, key, value2) {
  map4 ??= new Map;
  map4.set(key, value2);
  return map4;
}
function remove(map4, key) {
  map4?.delete(key);
  return map4;
}

// build/dev/javascript/lustre/lustre/internals/ref.ffi.mjs
function sameValueZero(x, y) {
  if (typeof x === "number" && typeof y === "number") {
    return x === y || x !== x && y !== y;
  }
  return x === y;
}

// build/dev/javascript/lustre/lustre/internals/ref.mjs
function equal_lists(loop$xs, loop$ys) {
  while (true) {
    let xs = loop$xs;
    let ys = loop$ys;
    if (xs instanceof Empty) {
      if (ys instanceof Empty) {
        return true;
      } else {
        return false;
      }
    } else if (ys instanceof Empty) {
      return false;
    } else {
      let x = xs.head;
      let xs$1 = xs.tail;
      let y = ys.head;
      let ys$1 = ys.tail;
      let $ = sameValueZero(x, y);
      if ($) {
        loop$xs = xs$1;
        loop$ys = ys$1;
      } else {
        return $;
      }
    }
  }
}

// build/dev/javascript/lustre/lustre/vdom/vnode.mjs
class Fragment extends CustomType {
  constructor(kind, key, children, keyed_children) {
    super();
    this.kind = kind;
    this.key = key;
    this.children = children;
    this.keyed_children = keyed_children;
  }
}
class Element extends CustomType {
  constructor(kind, key, namespace, tag, attributes, children, keyed_children, self_closing, void$) {
    super();
    this.kind = kind;
    this.key = key;
    this.namespace = namespace;
    this.tag = tag;
    this.attributes = attributes;
    this.children = children;
    this.keyed_children = keyed_children;
    this.self_closing = self_closing;
    this.void = void$;
  }
}
class Text extends CustomType {
  constructor(kind, key, content) {
    super();
    this.kind = kind;
    this.key = key;
    this.content = content;
  }
}
class UnsafeInnerHtml extends CustomType {
  constructor(kind, key, namespace, tag, attributes, inner_html) {
    super();
    this.kind = kind;
    this.key = key;
    this.namespace = namespace;
    this.tag = tag;
    this.attributes = attributes;
    this.inner_html = inner_html;
  }
}
class Map2 extends CustomType {
  constructor(kind, key, mapper, child) {
    super();
    this.kind = kind;
    this.key = key;
    this.mapper = mapper;
    this.child = child;
  }
}
class Memo extends CustomType {
  constructor(kind, key, dependencies, view) {
    super();
    this.kind = kind;
    this.key = key;
    this.dependencies = dependencies;
    this.view = view;
  }
}
var fragment_kind = 0;
var element_kind = 1;
var text_kind = 2;
var unsafe_inner_html_kind = 3;
var map_kind = 4;
var memo_kind = 5;
function fragment(key, children, keyed_children) {
  return new Fragment(fragment_kind, key, children, keyed_children);
}
function element(key, namespace, tag, attributes, children, keyed_children, self_closing, void$) {
  return new Element(element_kind, key, namespace, tag, prepare(attributes), children, keyed_children, self_closing, void$);
}
function is_void_html_element(tag, namespace) {
  if (namespace === "") {
    if (tag === "area") {
      return true;
    } else if (tag === "base") {
      return true;
    } else if (tag === "br") {
      return true;
    } else if (tag === "col") {
      return true;
    } else if (tag === "embed") {
      return true;
    } else if (tag === "hr") {
      return true;
    } else if (tag === "img") {
      return true;
    } else if (tag === "input") {
      return true;
    } else if (tag === "link") {
      return true;
    } else if (tag === "meta") {
      return true;
    } else if (tag === "param") {
      return true;
    } else if (tag === "source") {
      return true;
    } else if (tag === "track") {
      return true;
    } else if (tag === "wbr") {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}
function text(key, content) {
  return new Text(text_kind, key, content);
}
function map4(element2, mapper) {
  if (element2 instanceof Map2) {
    let child_mapper = element2.mapper;
    return new Map2(map_kind, element2.key, (handler) => {
      return identity2(mapper)(child_mapper(handler));
    }, identity2(element2.child));
  } else {
    return new Map2(map_kind, element2.key, identity2(mapper), identity2(element2));
  }
}
function memo(key, dependencies, view) {
  return new Memo(memo_kind, key, dependencies, view);
}
function to_keyed(key, node) {
  if (node instanceof Fragment) {
    return new Fragment(node.kind, key, node.children, node.keyed_children);
  } else if (node instanceof Element) {
    return new Element(node.kind, key, node.namespace, node.tag, node.attributes, node.children, node.keyed_children, node.self_closing, node.void);
  } else if (node instanceof Text) {
    return new Text(node.kind, key, node.content);
  } else if (node instanceof UnsafeInnerHtml) {
    return new UnsafeInnerHtml(node.kind, key, node.namespace, node.tag, node.attributes, node.inner_html);
  } else if (node instanceof Map2) {
    let child = node.child;
    return new Map2(node.kind, key, node.mapper, to_keyed(key, child));
  } else {
    let view = node.view;
    return new Memo(node.kind, key, node.dependencies, () => {
      return to_keyed(key, view());
    });
  }
}

// build/dev/javascript/lustre/lustre/element.mjs
function element2(tag, attributes, children) {
  return element("", "", tag, attributes, children, empty2(), false, is_void_html_element(tag, ""));
}
function text2(content) {
  return text("", content);
}
function none2() {
  return text("", "");
}
function memo2(dependencies, view) {
  return memo("", dependencies, view);
}
function ref(value2) {
  return identity2(value2);
}
function map5(element3, f) {
  return map4(element3, f);
}

// build/dev/javascript/lustre/lustre/element/html.mjs
function text3(content) {
  return text2(content);
}
function h1(attrs, children) {
  return element2("h1", attrs, children);
}
function h2(attrs, children) {
  return element2("h2", attrs, children);
}
function main(attrs, children) {
  return element2("main", attrs, children);
}
function li(attrs, children) {
  return element2("li", attrs, children);
}
function p(attrs, children) {
  return element2("p", attrs, children);
}
function pre(attrs, children) {
  return element2("pre", attrs, children);
}
function ul(attrs, children) {
  return element2("ul", attrs, children);
}
function button(attrs, children) {
  return element2("button", attrs, children);
}
function input(attrs) {
  return element2("input", attrs, empty_list);
}
function label(attrs, children) {
  return element2("label", attrs, children);
}

// build/dev/javascript/lustre/lustre/vdom/patch.mjs
class Patch extends CustomType {
  constructor(index4, path, removed, changes, children) {
    super();
    this.index = index4;
    this.path = path;
    this.removed = removed;
    this.changes = changes;
    this.children = children;
  }
}
class ReplaceText extends CustomType {
  constructor(kind, content) {
    super();
    this.kind = kind;
    this.content = content;
  }
}
class ReplaceInnerHtml extends CustomType {
  constructor(kind, inner_html) {
    super();
    this.kind = kind;
    this.inner_html = inner_html;
  }
}
class Update extends CustomType {
  constructor(kind, added, removed) {
    super();
    this.kind = kind;
    this.added = added;
    this.removed = removed;
  }
}
class Move extends CustomType {
  constructor(kind, key, before) {
    super();
    this.kind = kind;
    this.key = key;
    this.before = before;
  }
}
class Replace extends CustomType {
  constructor(kind, index4, with$) {
    super();
    this.kind = kind;
    this.index = index4;
    this.with = with$;
  }
}
class Remove extends CustomType {
  constructor(kind, index4) {
    super();
    this.kind = kind;
    this.index = index4;
  }
}
class Insert extends CustomType {
  constructor(kind, children, before) {
    super();
    this.kind = kind;
    this.children = children;
    this.before = before;
  }
}
var replace_text_kind = 0;
var replace_inner_html_kind = 1;
var update_kind = 2;
var move_kind = 3;
var remove_kind = 4;
var replace_kind = 5;
var insert_kind = 6;
function new$3(index4, removed, changes, children) {
  return new Patch(index4, empty_list, removed, changes, children);
}
function replace_text(content) {
  return new ReplaceText(replace_text_kind, content);
}
function replace_inner_html(inner_html) {
  return new ReplaceInnerHtml(replace_inner_html_kind, inner_html);
}
function update(added, removed) {
  return new Update(update_kind, added, removed);
}
function move(key, before) {
  return new Move(move_kind, key, before);
}
function remove2(index4) {
  return new Remove(remove_kind, index4);
}
function replace2(index4, with$) {
  return new Replace(replace_kind, index4, with$);
}
function insert3(children, before) {
  return new Insert(insert_kind, children, before);
}
function add_parent(child, index4) {
  return new Patch(index4, prepend(child.index, child.path), child.removed, child.changes, child.children);
}

// build/dev/javascript/lustre/lustre/runtime/transport.mjs
class Mount extends CustomType {
  constructor(kind, open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom, memos) {
    super();
    this.kind = kind;
    this.open_shadow_root = open_shadow_root;
    this.will_adopt_styles = will_adopt_styles;
    this.observed_attributes = observed_attributes;
    this.observed_properties = observed_properties;
    this.requested_contexts = requested_contexts;
    this.provided_contexts = provided_contexts;
    this.vdom = vdom;
    this.memos = memos;
  }
}
class Reconcile extends CustomType {
  constructor(kind, patch, memos) {
    super();
    this.kind = kind;
    this.patch = patch;
    this.memos = memos;
  }
}
class Emit extends CustomType {
  constructor(kind, name, data3) {
    super();
    this.kind = kind;
    this.name = name;
    this.data = data3;
  }
}
class Provide extends CustomType {
  constructor(kind, key, value2) {
    super();
    this.kind = kind;
    this.key = key;
    this.value = value2;
  }
}
class Subscribe extends CustomType {
  constructor(kind, key) {
    super();
    this.kind = kind;
    this.key = key;
  }
}
class Unsubscribe extends CustomType {
  constructor(kind, key) {
    super();
    this.kind = kind;
    this.key = key;
  }
}
class Batch extends CustomType {
  constructor(kind, messages) {
    super();
    this.kind = kind;
    this.messages = messages;
  }
}
var ServerMessage$isBatch = (value2) => value2 instanceof Batch;
class AttributeChanged extends CustomType {
  constructor(kind, name, value2) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value2;
  }
}
var ServerMessage$isAttributeChanged = (value2) => value2 instanceof AttributeChanged;
class PropertyChanged extends CustomType {
  constructor(kind, name, value2) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value2;
  }
}
var ServerMessage$isPropertyChanged = (value2) => value2 instanceof PropertyChanged;
class EventFired extends CustomType {
  constructor(kind, path, name, event2) {
    super();
    this.kind = kind;
    this.path = path;
    this.name = name;
    this.event = event2;
  }
}
var ServerMessage$isEventFired = (value2) => value2 instanceof EventFired;
class ContextProvided extends CustomType {
  constructor(kind, key, value2) {
    super();
    this.kind = kind;
    this.key = key;
    this.value = value2;
  }
}
var ServerMessage$isContextProvided = (value2) => value2 instanceof ContextProvided;
var mount_kind = 0;
var reconcile_kind = 1;
var emit_kind = 2;
var provide_kind = 3;
var subscribe_kind = 4;
var unsubscribe_kind = 5;
function mount(open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom, memos) {
  return new Mount(mount_kind, open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom, memos);
}
function reconcile(patch, memos) {
  return new Reconcile(reconcile_kind, patch, memos);
}
function emit(name, data3) {
  return new Emit(emit_kind, name, data3);
}
function provide(key, value2) {
  return new Provide(provide_kind, key, value2);
}
function subscribe(key) {
  return new Subscribe(subscribe_kind, key);
}
function unsubscribe(key) {
  return new Unsubscribe(unsubscribe_kind, key);
}

// build/dev/javascript/lustre/lustre/vdom/path.mjs
class Root extends CustomType {
}

class Key extends CustomType {
  constructor(key, parent) {
    super();
    this.key = key;
    this.parent = parent;
  }
}

class Index extends CustomType {
  constructor(index4, parent) {
    super();
    this.index = index4;
    this.parent = parent;
  }
}

class Subtree extends CustomType {
  constructor(parent) {
    super();
    this.parent = parent;
  }
}
var separator_subtree = "\r";
var separator_element = "\t";
var separator_event = `
`;
var root = /* @__PURE__ */ new Root;
function finish_to_string(acc) {
  if (acc instanceof Empty) {
    return "";
  } else {
    let segments = acc.tail;
    return concat2(segments);
  }
}
function do_to_string(loop$full, loop$path, loop$acc) {
  while (true) {
    let full = loop$full;
    let path = loop$path;
    let acc = loop$acc;
    if (path instanceof Root) {
      return finish_to_string(acc);
    } else if (path instanceof Key) {
      let key = path.key;
      let parent = path.parent;
      loop$full = full;
      loop$path = parent;
      loop$acc = prepend(separator_element, prepend(key, acc));
    } else if (path instanceof Index) {
      let index4 = path.index;
      let parent = path.parent;
      let acc$1 = prepend(separator_element, prepend(to_string(index4), acc));
      loop$full = full;
      loop$path = parent;
      loop$acc = acc$1;
    } else if (!full) {
      return finish_to_string(acc);
    } else {
      let parent = path.parent;
      if (acc instanceof Empty) {
        loop$full = full;
        loop$path = parent;
        loop$acc = acc;
      } else {
        let acc$1 = acc.tail;
        loop$full = full;
        loop$path = parent;
        loop$acc = prepend(separator_subtree, acc$1);
      }
    }
  }
}
function to_string4(path) {
  return do_to_string(true, path, empty_list);
}
function do_matches(loop$path, loop$candidates) {
  while (true) {
    let path = loop$path;
    let candidates = loop$candidates;
    if (candidates instanceof Empty) {
      return false;
    } else {
      let candidate = candidates.head;
      let rest = candidates.tail;
      let $ = starts_with(path, candidate);
      if ($) {
        return $;
      } else {
        loop$path = path;
        loop$candidates = rest;
      }
    }
  }
}
function matches(path, candidates) {
  if (candidates instanceof Empty) {
    return false;
  } else {
    return do_matches(to_string4(path), candidates);
  }
}
function split_subtree_path(path) {
  return split2(path, separator_subtree);
}
function add2(parent, index4, key) {
  if (key === "") {
    return new Index(index4, parent);
  } else {
    return new Key(key, parent);
  }
}
function subtree(path) {
  return new Subtree(path);
}
function event2(path, event3) {
  return do_to_string(false, path, prepend(separator_event, prepend(event3, empty_list)));
}
function child(path) {
  return do_to_string(false, path, empty_list);
}

// build/dev/javascript/lustre/lustre/vdom/cache.mjs
class Cache extends CustomType {
  constructor(events, vdoms, old_vdoms, dispatched_paths, next_dispatched_paths) {
    super();
    this.events = events;
    this.vdoms = vdoms;
    this.old_vdoms = old_vdoms;
    this.dispatched_paths = dispatched_paths;
    this.next_dispatched_paths = next_dispatched_paths;
  }
}

class Events extends CustomType {
  constructor(handlers, children) {
    super();
    this.handlers = handlers;
    this.children = children;
  }
}

class Child extends CustomType {
  constructor(mapper, events) {
    super();
    this.mapper = mapper;
    this.events = events;
  }
}

class AddedChildren extends CustomType {
  constructor(handlers, children, vdoms) {
    super();
    this.handlers = handlers;
    this.children = children;
    this.vdoms = vdoms;
  }
}

class DecodedEvent extends CustomType {
  constructor(path, handler) {
    super();
    this.path = path;
    this.handler = handler;
  }
}

class DispatchedEvent extends CustomType {
  constructor(path) {
    super();
    this.path = path;
  }
}
function compose_mapper(mapper, child_mapper) {
  return (message) => {
    return mapper(child_mapper(message));
  };
}
function new_events() {
  return new Events(empty2(), empty2());
}
function new$4() {
  return new Cache(new_events(), empty2(), empty2(), empty_list, empty_list);
}
function do_add_event(handlers, path, name, handler) {
  return insert2(handlers, event2(path, name), handler);
}
function add_attributes(handlers, path, attributes) {
  return fold2(attributes, handlers, (events, attribute3) => {
    if (attribute3 instanceof Event2) {
      let name = attribute3.name;
      let handler = attribute3.handler;
      return do_add_event(events, path, name, handler);
    } else {
      return events;
    }
  });
}
function do_add_children(loop$handlers, loop$children, loop$vdoms, loop$parent, loop$child_index, loop$nodes) {
  while (true) {
    let handlers = loop$handlers;
    let children = loop$children;
    let vdoms = loop$vdoms;
    let parent = loop$parent;
    let child_index = loop$child_index;
    let nodes = loop$nodes;
    let next = child_index + 1;
    if (nodes instanceof Empty) {
      return new AddedChildren(handlers, children, vdoms);
    } else {
      let $ = nodes.head;
      if ($ instanceof Fragment) {
        let rest = nodes.tail;
        let key = $.key;
        let nodes$1 = $.children;
        let path = add2(parent, child_index, key);
        let $1 = do_add_children(handlers, children, vdoms, path, 0, nodes$1);
        let handlers$1;
        let children$1;
        let vdoms$1;
        handlers$1 = $1.handlers;
        children$1 = $1.children;
        vdoms$1 = $1.vdoms;
        loop$handlers = handlers$1;
        loop$children = children$1;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof Element) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let nodes$1 = $.children;
        let path = add2(parent, child_index, key);
        let handlers$1 = add_attributes(handlers, path, attributes);
        let $1 = do_add_children(handlers$1, children, vdoms, path, 0, nodes$1);
        let handlers$2;
        let children$1;
        let vdoms$1;
        handlers$2 = $1.handlers;
        children$1 = $1.children;
        vdoms$1 = $1.vdoms;
        loop$handlers = handlers$2;
        loop$children = children$1;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof Text) {
        let rest = nodes.tail;
        loop$handlers = handlers;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof UnsafeInnerHtml) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let path = add2(parent, child_index, key);
        let handlers$1 = add_attributes(handlers, path, attributes);
        loop$handlers = handlers$1;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else if ($ instanceof Map2) {
        let rest = nodes.tail;
        let key = $.key;
        let mapper = $.mapper;
        let child2 = $.child;
        let path = add2(parent, child_index, key);
        let added = do_add_children(empty2(), empty2(), vdoms, subtree(path), 0, singleton_list(child2));
        let vdoms$1 = added.vdoms;
        let child_events = new Events(added.handlers, added.children);
        let child$1 = new Child(mapper, child_events);
        let children$1 = insert2(children, child(path), child$1);
        loop$handlers = handlers;
        loop$children = children$1;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next;
        loop$nodes = rest;
      } else {
        let rest = nodes.tail;
        let view = $.view;
        let child_node = view();
        let vdoms$1 = insert2(vdoms, view, child_node);
        let next$1 = child_index;
        let rest$1 = prepend(child_node, rest);
        loop$handlers = handlers;
        loop$children = children;
        loop$vdoms = vdoms$1;
        loop$parent = parent;
        loop$child_index = next$1;
        loop$nodes = rest$1;
      }
    }
  }
}
function add_children(cache, events, path, child_index, nodes) {
  let vdoms = cache.vdoms;
  let handlers;
  let children;
  handlers = events.handlers;
  children = events.children;
  let $ = do_add_children(handlers, children, vdoms, path, child_index, nodes);
  let handlers$1;
  let children$1;
  let vdoms$1;
  handlers$1 = $.handlers;
  children$1 = $.children;
  vdoms$1 = $.vdoms;
  return [
    new Cache(cache.events, vdoms$1, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths),
    new Events(handlers$1, children$1)
  ];
}
function add_child(cache, events, parent, index4, child2) {
  let children = singleton_list(child2);
  return add_children(cache, events, parent, index4, children);
}
function from_node(root2) {
  let cache = new$4();
  let $ = add_child(cache, cache.events, root, 0, root2);
  let cache$1;
  let events$1;
  cache$1 = $[0];
  events$1 = $[1];
  return new Cache(events$1, cache$1.vdoms, cache$1.old_vdoms, cache$1.dispatched_paths, cache$1.next_dispatched_paths);
}
function tick(cache) {
  return new Cache(cache.events, empty2(), cache.vdoms, cache.next_dispatched_paths, empty_list);
}
function events(cache) {
  return cache.events;
}
function update_events(cache, events2) {
  return new Cache(events2, cache.vdoms, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths);
}
function memos(cache) {
  return cache.vdoms;
}
function get_old_memo(cache, old, new$5) {
  return get_or_compute(cache.old_vdoms, old, new$5);
}
function keep_memo(cache, old, new$5) {
  let node = get_or_compute(cache.old_vdoms, old, new$5);
  let vdoms = insert2(cache.vdoms, new$5, node);
  return new Cache(cache.events, vdoms, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths);
}
function add_memo(cache, new$5, node) {
  let vdoms = insert2(cache.vdoms, new$5, node);
  return new Cache(cache.events, vdoms, cache.old_vdoms, cache.dispatched_paths, cache.next_dispatched_paths);
}
function get_subtree(events2, path, old_mapper) {
  let child2 = get_or_compute(events2.children, path, () => {
    return new Child(old_mapper, new_events());
  });
  return child2.events;
}
function update_subtree(parent, path, mapper, events2) {
  let new_child = new Child(mapper, events2);
  let children = insert2(parent.children, path, new_child);
  return new Events(parent.handlers, children);
}
function add_event(events2, path, name, handler) {
  let handlers = do_add_event(events2.handlers, path, name, handler);
  return new Events(handlers, events2.children);
}
function do_remove_event(handlers, path, name) {
  return remove(handlers, event2(path, name));
}
function remove_event(events2, path, name) {
  let handlers = do_remove_event(events2.handlers, path, name);
  return new Events(handlers, events2.children);
}
function remove_attributes(handlers, path, attributes) {
  return fold2(attributes, handlers, (events2, attribute3) => {
    if (attribute3 instanceof Event2) {
      let name = attribute3.name;
      return do_remove_event(events2, path, name);
    } else {
      return events2;
    }
  });
}
function do_remove_children(loop$handlers, loop$children, loop$vdoms, loop$parent, loop$index, loop$nodes) {
  while (true) {
    let handlers = loop$handlers;
    let children = loop$children;
    let vdoms = loop$vdoms;
    let parent = loop$parent;
    let index4 = loop$index;
    let nodes = loop$nodes;
    let next = index4 + 1;
    if (nodes instanceof Empty) {
      return new Events(handlers, children);
    } else {
      let $ = nodes.head;
      if ($ instanceof Fragment) {
        let rest = nodes.tail;
        let key = $.key;
        let nodes$1 = $.children;
        let path = add2(parent, index4, key);
        let $1 = do_remove_children(handlers, children, vdoms, path, 0, nodes$1);
        let handlers$1;
        let children$1;
        handlers$1 = $1.handlers;
        children$1 = $1.children;
        loop$handlers = handlers$1;
        loop$children = children$1;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof Element) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let nodes$1 = $.children;
        let path = add2(parent, index4, key);
        let handlers$1 = remove_attributes(handlers, path, attributes);
        let $1 = do_remove_children(handlers$1, children, vdoms, path, 0, nodes$1);
        let handlers$2;
        let children$1;
        handlers$2 = $1.handlers;
        children$1 = $1.children;
        loop$handlers = handlers$2;
        loop$children = children$1;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof Text) {
        let rest = nodes.tail;
        loop$handlers = handlers;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof UnsafeInnerHtml) {
        let rest = nodes.tail;
        let key = $.key;
        let attributes = $.attributes;
        let path = add2(parent, index4, key);
        let handlers$1 = remove_attributes(handlers, path, attributes);
        loop$handlers = handlers$1;
        loop$children = children;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else if ($ instanceof Map2) {
        let rest = nodes.tail;
        let key = $.key;
        let path = add2(parent, index4, key);
        let children$1 = remove(children, child(path));
        loop$handlers = handlers;
        loop$children = children$1;
        loop$vdoms = vdoms;
        loop$parent = parent;
        loop$index = next;
        loop$nodes = rest;
      } else {
        let rest = nodes.tail;
        let view = $.view;
        let $1 = has_key(vdoms, view);
        if ($1) {
          let child2 = get2(vdoms, view);
          let nodes$1 = prepend(child2, rest);
          loop$handlers = handlers;
          loop$children = children;
          loop$vdoms = vdoms;
          loop$parent = parent;
          loop$index = index4;
          loop$nodes = nodes$1;
        } else {
          loop$handlers = handlers;
          loop$children = children;
          loop$vdoms = vdoms;
          loop$parent = parent;
          loop$index = next;
          loop$nodes = rest;
        }
      }
    }
  }
}
function remove_child(cache, events2, parent, child_index, child2) {
  return do_remove_children(events2.handlers, events2.children, cache.old_vdoms, parent, child_index, singleton_list(child2));
}
function replace_child(cache, events2, parent, child_index, prev, next) {
  let events$1 = remove_child(cache, events2, parent, child_index, prev);
  return add_child(cache, events$1, parent, child_index, next);
}
function get_handler(loop$events, loop$path, loop$mapper) {
  while (true) {
    let events2 = loop$events;
    let path = loop$path;
    let mapper = loop$mapper;
    if (path instanceof Empty) {
      return error_nil;
    } else {
      let $ = path.tail;
      if ($ instanceof Empty) {
        let key = path.head;
        let $1 = has_key(events2.handlers, key);
        if ($1) {
          let handler = get2(events2.handlers, key);
          return new Ok(map3(handler, (handler2) => {
            return new Handler(handler2.prevent_default, handler2.stop_propagation, identity2(mapper)(handler2.message));
          }));
        } else {
          return error_nil;
        }
      } else {
        let key = path.head;
        let path$1 = $;
        let $1 = has_key(events2.children, key);
        if ($1) {
          let child2 = get2(events2.children, key);
          let mapper$1 = compose_mapper(mapper, child2.mapper);
          loop$events = child2.events;
          loop$path = path$1;
          loop$mapper = mapper$1;
        } else {
          return error_nil;
        }
      }
    }
  }
}
function decode2(cache, path, name, event3) {
  let parts = split_subtree_path(path + separator_event + name);
  let $ = get_handler(cache.events, parts, identity2);
  if ($ instanceof Ok) {
    let handler = $[0];
    let $1 = run(event3, handler);
    if ($1 instanceof Ok) {
      let handler$1 = $1[0];
      return new DecodedEvent(path, handler$1);
    } else {
      return new DispatchedEvent(path);
    }
  } else {
    return new DispatchedEvent(path);
  }
}
function dispatch(cache, event3) {
  let next_dispatched_paths = prepend(event3.path, cache.next_dispatched_paths);
  let cache$1 = new Cache(cache.events, cache.vdoms, cache.old_vdoms, cache.dispatched_paths, next_dispatched_paths);
  if (event3 instanceof DecodedEvent) {
    let handler = event3.handler;
    return [cache$1, new Ok(handler)];
  } else {
    return [cache$1, error_nil];
  }
}
function handle(cache, path, name, event3) {
  let _pipe = decode2(cache, path, name, event3);
  return ((_capture) => {
    return dispatch(cache, _capture);
  })(_pipe);
}
function has_dispatched_events(cache, path) {
  return matches(path, cache.dispatched_paths);
}

// build/dev/javascript/lustre/lustre/runtime/server/runtime.mjs
class ClientDispatchedMessage extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
}
var Message$isClientDispatchedMessage = (value2) => value2 instanceof ClientDispatchedMessage;
class ClientRegisteredCallback extends CustomType {
  constructor(callback) {
    super();
    this.callback = callback;
  }
}
var Message$isClientRegisteredCallback = (value2) => value2 instanceof ClientRegisteredCallback;
class ClientDeregisteredCallback extends CustomType {
  constructor(callback) {
    super();
    this.callback = callback;
  }
}
var Message$isClientDeregisteredCallback = (value2) => value2 instanceof ClientDeregisteredCallback;
class EffectDispatchedMessage extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
}
var Message$EffectDispatchedMessage = (message) => new EffectDispatchedMessage(message);
var Message$isEffectDispatchedMessage = (value2) => value2 instanceof EffectDispatchedMessage;
class EffectEmitEvent extends CustomType {
  constructor(name, data3) {
    super();
    this.name = name;
    this.data = data3;
  }
}
var Message$EffectEmitEvent = (name, data3) => new EffectEmitEvent(name, data3);
var Message$isEffectEmitEvent = (value2) => value2 instanceof EffectEmitEvent;
class EffectProvidedValue extends CustomType {
  constructor(key, value2) {
    super();
    this.key = key;
    this.value = value2;
  }
}
var Message$EffectProvidedValue = (key, value2) => new EffectProvidedValue(key, value2);
var Message$isEffectProvidedValue = (value2) => value2 instanceof EffectProvidedValue;
class EffectRequestedContextSubscription extends CustomType {
  constructor(key, decoder) {
    super();
    this.key = key;
    this.decoder = decoder;
  }
}
var Message$EffectRequestedContextSubscription = (key, decoder) => new EffectRequestedContextSubscription(key, decoder);
var Message$isEffectRequestedContextSubscription = (value2) => value2 instanceof EffectRequestedContextSubscription;
class EffectRemovedContextSubscription extends CustomType {
  constructor(key) {
    super();
    this.key = key;
  }
}
var Message$EffectRemovedContextSubscription = (key) => new EffectRemovedContextSubscription(key);
var Message$isEffectRemovedContextSubscription = (value2) => value2 instanceof EffectRemovedContextSubscription;
class SystemRequestedShutdown extends CustomType {
}
var Message$isSystemRequestedShutdown = (value2) => value2 instanceof SystemRequestedShutdown;

// build/dev/javascript/lustre/lustre/runtime/app.mjs
class App extends CustomType {
  constructor(name, init, update2, view, config) {
    super();
    this.name = name;
    this.init = init;
    this.update = update2;
    this.view = view;
    this.config = config;
  }
}
class Config2 extends CustomType {
  constructor(open_shadow_root, adopt_styles, delegates_focus, attributes, properties, contexts, is_form_associated, on_form_autofill, on_form_reset, on_form_restore, on_form_disabled, on_connect, on_adopt, on_disconnect) {
    super();
    this.open_shadow_root = open_shadow_root;
    this.adopt_styles = adopt_styles;
    this.delegates_focus = delegates_focus;
    this.attributes = attributes;
    this.properties = properties;
    this.contexts = contexts;
    this.is_form_associated = is_form_associated;
    this.on_form_autofill = on_form_autofill;
    this.on_form_reset = on_form_reset;
    this.on_form_restore = on_form_restore;
    this.on_form_disabled = on_form_disabled;
    this.on_connect = on_connect;
    this.on_adopt = on_adopt;
    this.on_disconnect = on_disconnect;
  }
}
var default_config = /* @__PURE__ */ new Config2(true, true, false, empty_list, empty_list, empty_list, false, /* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None);

// build/dev/javascript/lustre/lustre/internals/equals.ffi.mjs
var isEqual2 = (a, b) => {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  const type = typeof a;
  if (type !== typeof b) {
    return false;
  }
  if (type !== "object") {
    return false;
  }
  const ctor = a.constructor;
  if (ctor !== b.constructor) {
    return false;
  }
  if (Array.isArray(a)) {
    return areArraysEqual(a, b);
  }
  return areObjectsEqual(a, b);
};
var areArraysEqual = (a, b) => {
  let index4 = a.length;
  if (index4 !== b.length) {
    return false;
  }
  while (index4--) {
    if (!isEqual2(a[index4], b[index4])) {
      return false;
    }
  }
  return true;
};
var areObjectsEqual = (a, b) => {
  const properties = Object.keys(a);
  let index4 = properties.length;
  if (Object.keys(b).length !== index4) {
    return false;
  }
  while (index4--) {
    const property3 = properties[index4];
    if (!Object.hasOwn(b, property3)) {
      return false;
    }
    if (!isEqual2(a[property3], b[property3])) {
      return false;
    }
  }
  return true;
};

// build/dev/javascript/lustre/lustre/vdom/diff.mjs
class Diff extends CustomType {
  constructor(patch, cache) {
    super();
    this.patch = patch;
    this.cache = cache;
  }
}
class PartialDiff extends CustomType {
  constructor(patch, cache, events2) {
    super();
    this.patch = patch;
    this.cache = cache;
    this.events = events2;
  }
}

class AttributeChange extends CustomType {
  constructor(added, removed, events2) {
    super();
    this.added = added;
    this.removed = removed;
    this.events = events2;
  }
}
function diff_attributes(loop$controlled, loop$path, loop$events, loop$old, loop$new, loop$added, loop$removed) {
  while (true) {
    let controlled = loop$controlled;
    let path = loop$path;
    let events2 = loop$events;
    let old = loop$old;
    let new$5 = loop$new;
    let added = loop$added;
    let removed = loop$removed;
    if (old instanceof Empty) {
      if (new$5 instanceof Empty) {
        return new AttributeChange(added, removed, events2);
      } else {
        let $ = new$5.head;
        if ($ instanceof Event2) {
          let next = $;
          let new$1 = new$5.tail;
          let name = $.name;
          let handler = $.handler;
          let events$1 = add_event(events2, path, name, handler);
          let added$1 = prepend(next, added);
          loop$controlled = controlled;
          loop$path = path;
          loop$events = events$1;
          loop$old = old;
          loop$new = new$1;
          loop$added = added$1;
          loop$removed = removed;
        } else {
          let next = $;
          let new$1 = new$5.tail;
          let added$1 = prepend(next, added);
          loop$controlled = controlled;
          loop$path = path;
          loop$events = events2;
          loop$old = old;
          loop$new = new$1;
          loop$added = added$1;
          loop$removed = removed;
        }
      }
    } else if (new$5 instanceof Empty) {
      let $ = old.head;
      if ($ instanceof Event2) {
        let prev = $;
        let old$1 = old.tail;
        let name = $.name;
        let events$1 = remove_event(events2, path, name);
        let removed$1 = prepend(prev, removed);
        loop$controlled = controlled;
        loop$path = path;
        loop$events = events$1;
        loop$old = old$1;
        loop$new = new$5;
        loop$added = added;
        loop$removed = removed$1;
      } else {
        let prev = $;
        let old$1 = old.tail;
        let removed$1 = prepend(prev, removed);
        loop$controlled = controlled;
        loop$path = path;
        loop$events = events2;
        loop$old = old$1;
        loop$new = new$5;
        loop$added = added;
        loop$removed = removed$1;
      }
    } else {
      let prev = old.head;
      let remaining_old = old.tail;
      let next = new$5.head;
      let remaining_new = new$5.tail;
      let $ = compare2(prev, next);
      if ($ instanceof Lt) {
        if (prev instanceof Event2) {
          let name = prev.name;
          loop$controlled = controlled;
          loop$path = path;
          loop$events = remove_event(events2, path, name);
          loop$old = remaining_old;
          loop$new = new$5;
          loop$added = added;
          loop$removed = prepend(prev, removed);
        } else {
          loop$controlled = controlled;
          loop$path = path;
          loop$events = events2;
          loop$old = remaining_old;
          loop$new = new$5;
          loop$added = added;
          loop$removed = prepend(prev, removed);
        }
      } else if ($ instanceof Eq) {
        if (prev instanceof Attribute) {
          if (next instanceof Attribute) {
            let _block;
            let $1 = next.name;
            if ($1 === "value") {
              _block = controlled || prev.value !== next.value;
            } else if ($1 === "checked") {
              _block = controlled || prev.value !== next.value;
            } else if ($1 === "selected") {
              _block = controlled || prev.value !== next.value;
            } else {
              _block = prev.value !== next.value;
            }
            let has_changes = _block;
            let _block$1;
            if (has_changes) {
              _block$1 = prepend(next, added);
            } else {
              _block$1 = added;
            }
            let added$1 = _block$1;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed;
          } else if (next instanceof Event2) {
            let name = next.name;
            let handler = next.handler;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = add_event(events2, path, name, handler);
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          } else {
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          }
        } else if (prev instanceof Property) {
          if (next instanceof Property) {
            let _block;
            let $1 = next.name;
            if ($1 === "scrollLeft") {
              _block = true;
            } else if ($1 === "scrollRight") {
              _block = true;
            } else if ($1 === "value") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else if ($1 === "checked") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else if ($1 === "selected") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else {
              _block = !isEqual2(prev.value, next.value);
            }
            let has_changes = _block;
            let _block$1;
            if (has_changes) {
              _block$1 = prepend(next, added);
            } else {
              _block$1 = added;
            }
            let added$1 = _block$1;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed;
          } else if (next instanceof Event2) {
            let name = next.name;
            let handler = next.handler;
            loop$controlled = controlled;
            loop$path = path;
            loop$events = add_event(events2, path, name, handler);
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          } else {
            loop$controlled = controlled;
            loop$path = path;
            loop$events = events2;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = prepend(next, added);
            loop$removed = prepend(prev, removed);
          }
        } else if (next instanceof Event2) {
          let name = next.name;
          let handler = next.handler;
          let has_changes = prev.prevent_default.kind !== next.prevent_default.kind || prev.stop_propagation.kind !== next.stop_propagation.kind || prev.debounce !== next.debounce || prev.throttle !== next.throttle;
          let _block;
          if (has_changes) {
            _block = prepend(next, added);
          } else {
            _block = added;
          }
          let added$1 = _block;
          loop$controlled = controlled;
          loop$path = path;
          loop$events = add_event(events2, path, name, handler);
          loop$old = remaining_old;
          loop$new = remaining_new;
          loop$added = added$1;
          loop$removed = removed;
        } else {
          let name = prev.name;
          loop$controlled = controlled;
          loop$path = path;
          loop$events = remove_event(events2, path, name);
          loop$old = remaining_old;
          loop$new = remaining_new;
          loop$added = prepend(next, added);
          loop$removed = prepend(prev, removed);
        }
      } else if (next instanceof Event2) {
        let name = next.name;
        let handler = next.handler;
        loop$controlled = controlled;
        loop$path = path;
        loop$events = add_event(events2, path, name, handler);
        loop$old = old;
        loop$new = remaining_new;
        loop$added = prepend(next, added);
        loop$removed = removed;
      } else {
        loop$controlled = controlled;
        loop$path = path;
        loop$events = events2;
        loop$old = old;
        loop$new = remaining_new;
        loop$added = prepend(next, added);
        loop$removed = removed;
      }
    }
  }
}
function is_controlled(cache, namespace, tag, path) {
  if (tag === "input" && namespace === "") {
    return has_dispatched_events(cache, path);
  } else if (tag === "select" && namespace === "") {
    return has_dispatched_events(cache, path);
  } else if (tag === "textarea" && namespace === "") {
    return has_dispatched_events(cache, path);
  } else {
    return false;
  }
}
function do_diff(loop$old, loop$old_keyed, loop$new, loop$new_keyed, loop$moved, loop$moved_offset, loop$removed, loop$node_index, loop$patch_index, loop$changes, loop$children, loop$path, loop$cache, loop$events) {
  while (true) {
    let old = loop$old;
    let old_keyed = loop$old_keyed;
    let new$5 = loop$new;
    let new_keyed = loop$new_keyed;
    let moved = loop$moved;
    let moved_offset = loop$moved_offset;
    let removed = loop$removed;
    let node_index = loop$node_index;
    let patch_index = loop$patch_index;
    let changes = loop$changes;
    let children = loop$children;
    let path = loop$path;
    let cache = loop$cache;
    let events2 = loop$events;
    if (old instanceof Empty) {
      if (new$5 instanceof Empty) {
        let _block;
        let $ = is_browser();
        if (changes instanceof Empty) {
          if (children instanceof Empty) {
            _block = new$3(patch_index, removed, changes, children);
          } else if (!$) {
            let $1 = children.tail;
            if ($1 instanceof Empty && removed === 0) {
              let child2 = children.head;
              _block = add_parent(child2, patch_index);
            } else {
              _block = new$3(patch_index, removed, changes, children);
            }
          } else {
            _block = new$3(patch_index, removed, changes, children);
          }
        } else {
          _block = new$3(patch_index, removed, changes, children);
        }
        let patch = _block;
        return new PartialDiff(patch, cache, events2);
      } else {
        let $ = add_children(cache, events2, path, node_index, new$5);
        let cache$1;
        let events$1;
        cache$1 = $[0];
        events$1 = $[1];
        let insert4 = insert3(new$5, node_index - moved_offset);
        let changes$1 = prepend(insert4, changes);
        let patch = new$3(patch_index, removed, changes$1, children);
        return new PartialDiff(patch, cache$1, events$1);
      }
    } else if (new$5 instanceof Empty) {
      let prev = old.head;
      let old$1 = old.tail;
      let $ = prev.key === "" || !has_key(moved, prev.key);
      if ($) {
        let events$1 = remove_child(cache, events2, path, node_index, prev);
        loop$old = old$1;
        loop$old_keyed = old_keyed;
        loop$new = new$5;
        loop$new_keyed = new_keyed;
        loop$moved = moved;
        loop$moved_offset = moved_offset;
        loop$removed = removed + 1;
        loop$node_index = node_index;
        loop$patch_index = patch_index;
        loop$changes = changes;
        loop$children = children;
        loop$path = path;
        loop$cache = cache;
        loop$events = events$1;
      } else {
        loop$old = old$1;
        loop$old_keyed = old_keyed;
        loop$new = new$5;
        loop$new_keyed = new_keyed;
        loop$moved = moved;
        loop$moved_offset = moved_offset;
        loop$removed = removed;
        loop$node_index = node_index;
        loop$patch_index = patch_index;
        loop$changes = changes;
        loop$children = children;
        loop$path = path;
        loop$cache = cache;
        loop$events = events2;
      }
    } else {
      let prev = old.head;
      let next = new$5.head;
      if (prev.key !== next.key) {
        let old_remaining = old.tail;
        let new_remaining = new$5.tail;
        let next_did_exist = has_key(old_keyed, next.key);
        let prev_does_exist = has_key(new_keyed, prev.key);
        if (prev_does_exist) {
          if (next_did_exist) {
            let $ = has_key(moved, prev.key);
            if ($) {
              loop$old = old_remaining;
              loop$old_keyed = old_keyed;
              loop$new = new$5;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset - 1;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            } else {
              let match = get2(old_keyed, next.key);
              let before = node_index - moved_offset;
              let changes$1 = prepend(move(next.key, before), changes);
              let moved$1 = insert2(moved, next.key, undefined);
              loop$old = prepend(match, old);
              loop$old_keyed = old_keyed;
              loop$new = new$5;
              loop$new_keyed = new_keyed;
              loop$moved = moved$1;
              loop$moved_offset = moved_offset + 1;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$changes = changes$1;
              loop$children = children;
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            }
          } else {
            let before = node_index - moved_offset;
            let $ = add_child(cache, events2, path, node_index, next);
            let cache$1;
            let events$1;
            cache$1 = $[0];
            events$1 = $[1];
            let insert4 = insert3(singleton_list(next), before);
            let changes$1 = prepend(insert4, changes);
            loop$old = old;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset + 1;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes$1;
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if (next_did_exist) {
          let index4 = node_index - moved_offset;
          let changes$1 = prepend(remove2(index4), changes);
          let events$1 = remove_child(cache, events2, path, node_index, prev);
          loop$old = old_remaining;
          loop$old_keyed = old_keyed;
          loop$new = new$5;
          loop$new_keyed = new_keyed;
          loop$moved = moved;
          loop$moved_offset = moved_offset - 1;
          loop$removed = removed;
          loop$node_index = node_index;
          loop$patch_index = patch_index;
          loop$changes = changes$1;
          loop$children = children;
          loop$path = path;
          loop$cache = cache;
          loop$events = events$1;
        } else {
          let change = replace2(node_index - moved_offset, next);
          let $ = replace_child(cache, events2, path, node_index, prev, next);
          let cache$1;
          let events$1;
          cache$1 = $[0];
          events$1 = $[1];
          loop$old = old_remaining;
          loop$old_keyed = old_keyed;
          loop$new = new_remaining;
          loop$new_keyed = new_keyed;
          loop$moved = moved;
          loop$moved_offset = moved_offset;
          loop$removed = removed;
          loop$node_index = node_index + 1;
          loop$patch_index = patch_index;
          loop$changes = prepend(change, changes);
          loop$children = children;
          loop$path = path;
          loop$cache = cache$1;
          loop$events = events$1;
        }
      } else {
        let $ = old.head;
        if ($ instanceof Fragment) {
          let $1 = new$5.head;
          if ($1 instanceof Fragment) {
            let prev2 = $;
            let old$1 = old.tail;
            let next2 = $1;
            let new$1 = new$5.tail;
            let $2 = do_diff(prev2.children, prev2.keyed_children, next2.children, next2.keyed_children, empty2(), 0, 0, 0, node_index, empty_list, empty_list, add2(path, node_index, next2.key), cache, events2);
            let patch;
            let cache$1;
            let events$1;
            patch = $2.patch;
            cache$1 = $2.cache;
            events$1 = $2.events;
            let _block;
            let $3 = patch.changes;
            if ($3 instanceof Empty) {
              let $4 = patch.children;
              if ($4 instanceof Empty) {
                let $5 = patch.removed;
                if ($5 === 0) {
                  _block = children;
                } else {
                  _block = prepend(patch, children);
                }
              } else {
                _block = prepend(patch, children);
              }
            } else {
              _block = prepend(patch, children);
            }
            let children$1 = _block;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes;
            loop$children = children$1;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          } else {
            let prev2 = $;
            let old_remaining = old.tail;
            let next2 = $1;
            let new_remaining = new$5.tail;
            let change = replace2(node_index - moved_offset, next2);
            let $2 = replace_child(cache, events2, path, node_index, prev2, next2);
            let cache$1;
            let events$1;
            cache$1 = $2[0];
            events$1 = $2[1];
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof Element) {
          let $1 = new$5.head;
          if ($1 instanceof Element) {
            let prev2 = $;
            let next2 = $1;
            if (prev2.namespace === next2.namespace && prev2.tag === next2.tag) {
              let old$1 = old.tail;
              let new$1 = new$5.tail;
              let child_path = add2(path, node_index, next2.key);
              let controlled = is_controlled(cache, next2.namespace, next2.tag, child_path);
              let $2 = diff_attributes(controlled, child_path, events2, prev2.attributes, next2.attributes, empty_list, empty_list);
              let added_attrs;
              let removed_attrs;
              let events$1;
              added_attrs = $2.added;
              removed_attrs = $2.removed;
              events$1 = $2.events;
              let _block;
              if (added_attrs instanceof Empty && removed_attrs instanceof Empty) {
                _block = empty_list;
              } else {
                _block = singleton_list(update(added_attrs, removed_attrs));
              }
              let initial_child_changes = _block;
              let $3 = do_diff(prev2.children, prev2.keyed_children, next2.children, next2.keyed_children, empty2(), 0, 0, 0, node_index, initial_child_changes, empty_list, child_path, cache, events$1);
              let patch;
              let cache$1;
              let events$2;
              patch = $3.patch;
              cache$1 = $3.cache;
              events$2 = $3.events;
              let _block$1;
              let $4 = patch.changes;
              if ($4 instanceof Empty) {
                let $5 = patch.children;
                if ($5 instanceof Empty) {
                  let $6 = patch.removed;
                  if ($6 === 0) {
                    _block$1 = children;
                  } else {
                    _block$1 = prepend(patch, children);
                  }
                } else {
                  _block$1 = prepend(patch, children);
                }
              } else {
                _block$1 = prepend(patch, children);
              }
              let children$1 = _block$1;
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children$1;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events$2;
            } else {
              let prev3 = $;
              let old_remaining = old.tail;
              let next3 = $1;
              let new_remaining = new$5.tail;
              let change = replace2(node_index - moved_offset, next3);
              let $2 = replace_child(cache, events2, path, node_index, prev3, next3);
              let cache$1;
              let events$1;
              cache$1 = $2[0];
              events$1 = $2[1];
              loop$old = old_remaining;
              loop$old_keyed = old_keyed;
              loop$new = new_remaining;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = prepend(change, changes);
              loop$children = children;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events$1;
            }
          } else {
            let prev2 = $;
            let old_remaining = old.tail;
            let next2 = $1;
            let new_remaining = new$5.tail;
            let change = replace2(node_index - moved_offset, next2);
            let $2 = replace_child(cache, events2, path, node_index, prev2, next2);
            let cache$1;
            let events$1;
            cache$1 = $2[0];
            events$1 = $2[1];
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof Text) {
          let $1 = new$5.head;
          if ($1 instanceof Text) {
            let prev2 = $;
            let next2 = $1;
            if (prev2.content === next2.content) {
              let old$1 = old.tail;
              let new$1 = new$5.tail;
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            } else {
              let old$1 = old.tail;
              let next3 = $1;
              let new$1 = new$5.tail;
              let child2 = new$3(node_index, 0, singleton_list(replace_text(next3.content)), empty_list);
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = prepend(child2, children);
              loop$path = path;
              loop$cache = cache;
              loop$events = events2;
            }
          } else {
            let prev2 = $;
            let old_remaining = old.tail;
            let next2 = $1;
            let new_remaining = new$5.tail;
            let change = replace2(node_index - moved_offset, next2);
            let $2 = replace_child(cache, events2, path, node_index, prev2, next2);
            let cache$1;
            let events$1;
            cache$1 = $2[0];
            events$1 = $2[1];
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof UnsafeInnerHtml) {
          let $1 = new$5.head;
          if ($1 instanceof UnsafeInnerHtml) {
            let prev2 = $;
            let old$1 = old.tail;
            let next2 = $1;
            let new$1 = new$5.tail;
            let child_path = add2(path, node_index, next2.key);
            let $2 = diff_attributes(false, child_path, events2, prev2.attributes, next2.attributes, empty_list, empty_list);
            let added_attrs;
            let removed_attrs;
            let events$1;
            added_attrs = $2.added;
            removed_attrs = $2.removed;
            events$1 = $2.events;
            let _block;
            if (added_attrs instanceof Empty && removed_attrs instanceof Empty) {
              _block = empty_list;
            } else {
              _block = singleton_list(update(added_attrs, removed_attrs));
            }
            let child_changes = _block;
            let _block$1;
            let $3 = prev2.inner_html === next2.inner_html;
            if ($3) {
              _block$1 = child_changes;
            } else {
              _block$1 = prepend(replace_inner_html(next2.inner_html), child_changes);
            }
            let child_changes$1 = _block$1;
            let _block$2;
            if (child_changes$1 instanceof Empty) {
              _block$2 = children;
            } else {
              _block$2 = prepend(new$3(node_index, 0, child_changes$1, empty_list), children);
            }
            let children$1 = _block$2;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes;
            loop$children = children$1;
            loop$path = path;
            loop$cache = cache;
            loop$events = events$1;
          } else {
            let prev2 = $;
            let old_remaining = old.tail;
            let next2 = $1;
            let new_remaining = new$5.tail;
            let change = replace2(node_index - moved_offset, next2);
            let $2 = replace_child(cache, events2, path, node_index, prev2, next2);
            let cache$1;
            let events$1;
            cache$1 = $2[0];
            events$1 = $2[1];
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else if ($ instanceof Map2) {
          let $1 = new$5.head;
          if ($1 instanceof Map2) {
            let prev2 = $;
            let old$1 = old.tail;
            let next2 = $1;
            let new$1 = new$5.tail;
            let child_path = add2(path, node_index, next2.key);
            let child_key = child(child_path);
            let $2 = do_diff(singleton_list(prev2.child), empty2(), singleton_list(next2.child), empty2(), empty2(), 0, 0, 0, node_index, empty_list, empty_list, subtree(child_path), cache, get_subtree(events2, child_key, prev2.mapper));
            let patch;
            let cache$1;
            let child_events;
            patch = $2.patch;
            cache$1 = $2.cache;
            child_events = $2.events;
            let events$1 = update_subtree(events2, child_key, next2.mapper, child_events);
            let _block;
            let $3 = patch.changes;
            if ($3 instanceof Empty) {
              let $4 = patch.children;
              if ($4 instanceof Empty) {
                let $5 = patch.removed;
                if ($5 === 0) {
                  _block = children;
                } else {
                  _block = prepend(patch, children);
                }
              } else {
                _block = prepend(patch, children);
              }
            } else {
              _block = prepend(patch, children);
            }
            let children$1 = _block;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = changes;
            loop$children = children$1;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          } else {
            let prev2 = $;
            let old_remaining = old.tail;
            let next2 = $1;
            let new_remaining = new$5.tail;
            let change = replace2(node_index - moved_offset, next2);
            let $2 = replace_child(cache, events2, path, node_index, prev2, next2);
            let cache$1;
            let events$1;
            cache$1 = $2[0];
            events$1 = $2[1];
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        } else {
          let $1 = new$5.head;
          if ($1 instanceof Memo) {
            let prev2 = $;
            let old$1 = old.tail;
            let next2 = $1;
            let new$1 = new$5.tail;
            let $2 = equal_lists(prev2.dependencies, next2.dependencies);
            if ($2) {
              let cache$1 = keep_memo(cache, prev2.view, next2.view);
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events2;
            } else {
              let prev_node = get_old_memo(cache, prev2.view, prev2.view);
              let next_node = next2.view();
              let cache$1 = add_memo(cache, next2.view, next_node);
              loop$old = prepend(prev_node, old$1);
              loop$old_keyed = old_keyed;
              loop$new = prepend(next_node, new$1);
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$changes = changes;
              loop$children = children;
              loop$path = path;
              loop$cache = cache$1;
              loop$events = events2;
            }
          } else {
            let prev2 = $;
            let old_remaining = old.tail;
            let next2 = $1;
            let new_remaining = new$5.tail;
            let change = replace2(node_index - moved_offset, next2);
            let $2 = replace_child(cache, events2, path, node_index, prev2, next2);
            let cache$1;
            let events$1;
            cache$1 = $2[0];
            events$1 = $2[1];
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$path = path;
            loop$cache = cache$1;
            loop$events = events$1;
          }
        }
      }
    }
  }
}
function diff(cache, old, new$5) {
  let cache$1 = tick(cache);
  let $ = do_diff(singleton_list(old), empty2(), singleton_list(new$5), empty2(), empty2(), 0, 0, 0, 0, empty_list, empty_list, root, cache$1, events(cache$1));
  let patch;
  let cache$2;
  let events2;
  patch = $.patch;
  cache$2 = $.cache;
  events2 = $.events;
  return new Diff(patch, update_events(cache$2, events2));
}

// build/dev/javascript/lustre/lustre/internals/list.ffi.mjs
var toList2 = (arr) => arr.reduceRight((xs, x) => List$NonEmpty(x, xs), empty_list);
var iterate = (list4, callback) => {
  if (Array.isArray(list4)) {
    for (let i = 0;i < list4.length; i++) {
      callback(list4[i]);
    }
  } else if (list4) {
    for (list4;List$NonEmpty$rest(list4); list4 = List$NonEmpty$rest(list4)) {
      callback(List$NonEmpty$first(list4));
    }
  }
};
var append4 = (a, b) => {
  if (!List$NonEmpty$rest(a)) {
    return b;
  } else if (!List$NonEmpty$rest(b)) {
    return a;
  } else {
    return append2(a, b);
  }
};

// build/dev/javascript/lustre/lustre/internals/constants.ffi.mjs
var NAMESPACE_HTML = "http://www.w3.org/1999/xhtml";
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;
var SUPPORTS_MOVE_BEFORE = !!globalThis.HTMLElement?.prototype?.moveBefore;

// build/dev/javascript/lustre/lustre/vdom/reconciler.ffi.mjs
var setTimeout = globalThis.setTimeout;
var clearTimeout = globalThis.clearTimeout;
var createElementNS = (ns, name) => globalThis.document.createElementNS(ns, name);
var createTextNode = (data3) => globalThis.document.createTextNode(data3);
var createComment = (data3) => globalThis.document.createComment(data3);
var createDocumentFragment = () => globalThis.document.createDocumentFragment();
var insertBefore = (parent, node, reference) => parent.insertBefore(node, reference);
var moveBefore = SUPPORTS_MOVE_BEFORE ? (parent, node, reference) => parent.moveBefore(node, reference) : insertBefore;
var removeChild = (parent, child2) => parent.removeChild(child2);
var getAttribute = (node, name) => node.getAttribute(name);
var setAttribute = (node, name, value2) => node.setAttribute(name, value2);
var removeAttribute = (node, name) => node.removeAttribute(name);
var addEventListener = (node, name, handler, options) => node.addEventListener(name, handler, options);
var removeEventListener = (node, name, handler) => node.removeEventListener(name, handler);
var setInnerHtml = (node, innerHtml) => node.innerHTML = innerHtml;
var setData = (node, data3) => node.data = data3;
var meta = Symbol("lustre");

class MetadataNode {
  constructor(kind, parent, node, key) {
    this.kind = kind;
    this.key = key;
    this.parent = parent;
    this.children = [];
    this.node = node;
    this.endNode = null;
    this.handlers = new Map;
    this.throttles = new Map;
    this.debouncers = new Map;
  }
  get isVirtual() {
    return this.kind === fragment_kind || this.kind === map_kind;
  }
  get parentNode() {
    return this.isVirtual ? this.node.parentNode : this.node;
  }
}
var insertMetadataChild = (kind, parent, node, index4, key) => {
  const child2 = new MetadataNode(kind, parent, node, key);
  node[meta] = child2;
  parent?.children.splice(index4, 0, child2);
  return child2;
};
var getPath = (node) => {
  let path = "";
  for (let current = node[meta];current.parent; current = current.parent) {
    const separator = current.parent && current.parent.kind === map_kind ? separator_subtree : separator_element;
    if (current.key) {
      path = `${separator}${current.key}${path}`;
    } else {
      const index4 = current.parent.children.indexOf(current);
      path = `${separator}${index4}${path}`;
    }
  }
  return path.slice(1);
};

class Reconciler {
  #root = null;
  #decodeEvent;
  #dispatch;
  #debug = false;
  constructor(root2, decodeEvent, dispatch2, { debug = false } = {}) {
    this.#root = root2;
    this.#decodeEvent = decodeEvent;
    this.#dispatch = dispatch2;
    this.#debug = debug;
  }
  mount(vdom) {
    insertMetadataChild(element_kind, null, this.#root, 0, null);
    this.#insertChild(this.#root, null, this.#root[meta], 0, vdom);
  }
  push(patch, memos2 = null) {
    this.#memos = memos2;
    this.#stack.push({ node: this.#root[meta], patch });
    this.#reconcile();
  }
  #memos;
  #stack = [];
  #reconcile() {
    const stack = this.#stack;
    while (stack.length) {
      let { node, patch } = stack.pop();
      const { path, changes, removed, children: childPatches } = patch;
      iterate(path, (index4) => {
        node = node.children[index4];
      });
      const { children: childNodes } = node;
      iterate(changes, (change) => this.#patch(node, change));
      if (removed) {
        this.#removeChildren(node, childNodes.length - removed, removed);
      }
      iterate(childPatches, (childPatch) => {
        const child2 = childNodes[childPatch.index | 0];
        this.#stack.push({ node: child2, patch: childPatch });
      });
    }
  }
  #patch(node, change) {
    switch (change.kind) {
      case replace_text_kind:
        this.#replaceText(node, change);
        break;
      case replace_inner_html_kind:
        this.#replaceInnerHtml(node, change);
        break;
      case update_kind:
        this.#update(node, change);
        break;
      case move_kind:
        this.#move(node, change);
        break;
      case remove_kind:
        this.#remove(node, change);
        break;
      case replace_kind:
        this.#replace(node, change);
        break;
      case insert_kind:
        this.#insert(node, change);
        break;
    }
  }
  #insert(parent, { children, before }) {
    const fragment2 = createDocumentFragment();
    const beforeEl = this.#getReference(parent, before);
    this.#insertChildren(fragment2, null, parent, before | 0, children);
    insertBefore(parent.parentNode, fragment2, beforeEl);
  }
  #replace(parent, { index: index4, with: child2 }) {
    this.#removeChildren(parent, index4 | 0, 1);
    const beforeEl = this.#getReference(parent, index4);
    this.#insertChild(parent.parentNode, beforeEl, parent, index4 | 0, child2);
  }
  #getReference(node, index4) {
    index4 = index4 | 0;
    const { children } = node;
    const childCount = children.length;
    if (index4 < childCount)
      return children[index4].node;
    if (node.endNode)
      return node.endNode;
    if (!node.isVirtual)
      return null;
    while (node.isVirtual && node.children.length) {
      if (node.endNode)
        return node.endNode.nextSibling;
      node = node.children[node.children.length - 1];
    }
    return node.node.nextSibling;
  }
  #move(parent, { key, before }) {
    before = before | 0;
    const { children, parentNode } = parent;
    const beforeEl = children[before].node;
    let prev = children[before];
    for (let i = before + 1;i < children.length; ++i) {
      const next = children[i];
      children[i] = prev;
      prev = next;
      if (next.key === key) {
        children[before] = next;
        break;
      }
    }
    this.#moveChild(parentNode, prev, beforeEl);
  }
  #moveChildren(domParent, children, beforeEl) {
    for (let i = 0;i < children.length; ++i) {
      this.#moveChild(domParent, children[i], beforeEl);
    }
  }
  #moveChild(domParent, child2, beforeEl) {
    moveBefore(domParent, child2.node, beforeEl);
    if (child2.isVirtual) {
      this.#moveChildren(domParent, child2.children, beforeEl);
    }
    if (child2.endNode) {
      moveBefore(domParent, child2.endNode, beforeEl);
    }
  }
  #remove(parent, { index: index4 }) {
    this.#removeChildren(parent, index4, 1);
  }
  #removeChildren(parent, index4, count) {
    const { children, parentNode } = parent;
    const deleted = children.splice(index4, count);
    for (let i = 0;i < deleted.length; ++i) {
      const child2 = deleted[i];
      const { node, endNode, isVirtual, children: nestedChildren } = child2;
      removeChild(parentNode, node);
      if (endNode) {
        removeChild(parentNode, endNode);
      }
      this.#removeDebouncers(child2);
      if (isVirtual) {
        deleted.push(...nestedChildren);
      }
    }
  }
  #removeDebouncers(node) {
    const { debouncers, children } = node;
    for (const { timeout } of debouncers.values()) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    debouncers.clear();
    iterate(children, (child2) => this.#removeDebouncers(child2));
  }
  #update({ node, handlers, throttles, debouncers }, { added, removed }) {
    iterate(removed, ({ name }) => {
      if (handlers.delete(name)) {
        removeEventListener(node, name, handleEvent);
        this.#updateDebounceThrottle(throttles, name, 0);
        this.#updateDebounceThrottle(debouncers, name, 0);
      } else {
        removeAttribute(node, name);
        SYNCED_ATTRIBUTES[name]?.removed?.(node, name);
      }
    });
    iterate(added, (attribute3) => this.#createAttribute(node, attribute3));
  }
  #replaceText({ node }, { content }) {
    setData(node, content ?? "");
  }
  #replaceInnerHtml({ node }, { inner_html }) {
    setInnerHtml(node, inner_html ?? "");
  }
  #insertChildren(domParent, beforeEl, metaParent, index4, children) {
    iterate(children, (child2) => this.#insertChild(domParent, beforeEl, metaParent, index4++, child2));
  }
  #insertChild(domParent, beforeEl, metaParent, index4, vnode) {
    switch (vnode.kind) {
      case element_kind: {
        const node = this.#createElement(metaParent, index4, vnode);
        this.#insertChildren(node, null, node[meta], 0, vnode.children);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case text_kind: {
        const node = this.#createTextNode(metaParent, index4, vnode);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case fragment_kind: {
        const marker = "lustre:fragment";
        const head = this.#createHead(marker, metaParent, index4, vnode);
        insertBefore(domParent, head, beforeEl);
        this.#insertChildren(domParent, beforeEl, head[meta], 0, vnode.children);
        if (this.#debug) {
          head[meta].endNode = createComment(` /${marker} `);
          insertBefore(domParent, head[meta].endNode, beforeEl);
        }
        break;
      }
      case unsafe_inner_html_kind: {
        const node = this.#createElement(metaParent, index4, vnode);
        this.#replaceInnerHtml({ node }, vnode);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case map_kind: {
        const head = this.#createHead("lustre:map", metaParent, index4, vnode);
        insertBefore(domParent, head, beforeEl);
        this.#insertChild(domParent, beforeEl, head[meta], 0, vnode.child);
        break;
      }
      case memo_kind: {
        const child2 = this.#memos?.get(vnode.view) ?? vnode.view();
        this.#insertChild(domParent, beforeEl, metaParent, index4, child2);
        break;
      }
    }
  }
  #createElement(parent, index4, { kind, key, tag, namespace, attributes }) {
    const node = createElementNS(namespace || NAMESPACE_HTML, tag);
    insertMetadataChild(kind, parent, node, index4, key);
    if (this.#debug && key) {
      setAttribute(node, "data-lustre-key", key);
    }
    iterate(attributes, (attribute3) => this.#createAttribute(node, attribute3));
    return node;
  }
  #createTextNode(parent, index4, { kind, key, content }) {
    const node = createTextNode(content ?? "");
    insertMetadataChild(kind, parent, node, index4, key);
    return node;
  }
  #createHead(marker, parent, index4, { kind, key }) {
    const node = this.#debug ? createComment(markerComment(marker, key)) : createTextNode("");
    insertMetadataChild(kind, parent, node, index4, key);
    return node;
  }
  #createAttribute(node, attribute3) {
    const { debouncers, handlers, throttles } = node[meta];
    const {
      kind,
      name,
      value: value2,
      prevent_default: prevent,
      debounce: debounceDelay,
      throttle: throttleDelay
    } = attribute3;
    switch (kind) {
      case attribute_kind: {
        const valueOrDefault = value2 ?? "";
        if (name === "virtual:defaultValue") {
          node.defaultValue = valueOrDefault;
          return;
        } else if (name === "virtual:defaultChecked") {
          node.defaultChecked = true;
          return;
        } else if (name === "virtual:defaultSelected") {
          node.defaultSelected = true;
          return;
        }
        if (valueOrDefault !== getAttribute(node, name)) {
          setAttribute(node, name, valueOrDefault);
        }
        SYNCED_ATTRIBUTES[name]?.added?.(node, valueOrDefault);
        break;
      }
      case property_kind:
        node[name] = value2;
        break;
      case event_kind: {
        if (handlers.has(name)) {
          removeEventListener(node, name, handleEvent);
        }
        const passive = prevent.kind === never_kind;
        addEventListener(node, name, handleEvent, { passive });
        this.#updateDebounceThrottle(throttles, name, throttleDelay);
        this.#updateDebounceThrottle(debouncers, name, debounceDelay);
        handlers.set(name, (event3) => this.#handleEvent(attribute3, event3));
        break;
      }
    }
  }
  #updateDebounceThrottle(map6, name, delay) {
    const debounceOrThrottle = map6.get(name);
    if (delay > 0) {
      if (debounceOrThrottle) {
        debounceOrThrottle.delay = delay;
      } else {
        map6.set(name, { delay });
      }
    } else if (debounceOrThrottle) {
      const { timeout } = debounceOrThrottle;
      if (timeout) {
        clearTimeout(timeout);
      }
      map6.delete(name);
    }
  }
  #handleEvent(attribute3, event3) {
    const { currentTarget, type } = event3;
    const { debouncers, throttles } = currentTarget[meta];
    const path = getPath(currentTarget);
    const {
      prevent_default: prevent,
      stop_propagation: stop,
      include
    } = attribute3;
    if (prevent.kind === always_kind)
      event3.preventDefault();
    if (stop.kind === always_kind)
      event3.stopPropagation();
    if (type === "submit") {
      event3.detail ??= {};
      event3.detail.formData = [
        ...new FormData(event3.target, event3.submitter).entries()
      ];
    }
    const data3 = this.#decodeEvent(event3, path, type, include);
    const throttle = throttles.get(type);
    if (throttle) {
      const now = Date.now();
      const last = throttle.last || 0;
      if (now > last + throttle.delay) {
        throttle.last = now;
        throttle.lastEvent = event3;
        this.#dispatch(event3, data3);
      }
    }
    const debounce = debouncers.get(type);
    if (debounce) {
      clearTimeout(debounce.timeout);
      debounce.timeout = setTimeout(() => {
        if (event3 === throttles.get(type)?.lastEvent)
          return;
        this.#dispatch(event3, data3);
      }, debounce.delay);
    }
    if (!throttle && !debounce) {
      this.#dispatch(event3, data3);
    }
  }
}
var markerComment = (marker, key) => {
  if (key) {
    return ` ${marker} key="${escape(key)}" `;
  } else {
    return ` ${marker} `;
  }
};
var handleEvent = (event3) => {
  const { currentTarget, type } = event3;
  const handler = currentTarget[meta].handlers.get(type);
  handler(event3);
};
var syncedBooleanAttribute = (name) => {
  return {
    added(node) {
      node[name] = true;
    },
    removed(node) {
      node[name] = false;
    }
  };
};
var syncedAttribute = (name) => {
  return {
    added(node, value2) {
      node[name] = value2;
    }
  };
};
var SYNCED_ATTRIBUTES = {
  checked: syncedBooleanAttribute("checked"),
  selected: syncedBooleanAttribute("selected"),
  value: syncedAttribute("value"),
  autofocus: {
    added(node) {
      queueMicrotask(() => {
        node.focus?.();
      });
    }
  },
  autoplay: {
    added(node) {
      try {
        node.play?.();
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// build/dev/javascript/lustre/lustre/element/keyed.mjs
function do_extract_keyed_children(loop$key_children_pairs, loop$keyed_children, loop$children) {
  while (true) {
    let key_children_pairs = loop$key_children_pairs;
    let keyed_children = loop$keyed_children;
    let children = loop$children;
    if (key_children_pairs instanceof Empty) {
      return [keyed_children, reverse(children)];
    } else {
      let rest = key_children_pairs.tail;
      let key = key_children_pairs.head[0];
      let element$1 = key_children_pairs.head[1];
      let keyed_element = to_keyed(key, element$1);
      let _block;
      if (key === "") {
        _block = keyed_children;
      } else {
        _block = insert2(keyed_children, key, keyed_element);
      }
      let keyed_children$1 = _block;
      let children$1 = prepend(keyed_element, children);
      loop$key_children_pairs = rest;
      loop$keyed_children = keyed_children$1;
      loop$children = children$1;
    }
  }
}
function extract_keyed_children(children) {
  return do_extract_keyed_children(children, empty2(), empty_list);
}
function element3(tag, attributes, children) {
  let $ = extract_keyed_children(children);
  let keyed_children;
  let children$1;
  keyed_children = $[0];
  children$1 = $[1];
  return element("", "", tag, attributes, children$1, keyed_children, false, is_void_html_element(tag, ""));
}
function namespaced2(namespace, tag, attributes, children) {
  let $ = extract_keyed_children(children);
  let keyed_children;
  let children$1;
  keyed_children = $[0];
  children$1 = $[1];
  return element("", namespace, tag, attributes, children$1, keyed_children, false, is_void_html_element(tag, namespace));
}
function fragment2(children) {
  let $ = extract_keyed_children(children);
  let keyed_children;
  let children$1;
  keyed_children = $[0];
  children$1 = $[1];
  return fragment("", children$1, keyed_children);
}

// build/dev/javascript/lustre/lustre/vdom/virtualise.ffi.mjs
var virtualise = (root2) => {
  const rootMeta = insertMetadataChild(element_kind, null, root2, 0, null);
  const { children } = virtualiseChildren(rootMeta, root2, root2.firstChild);
  if (children.length > 1) {
    const rootNodeMeta = insertMetadataChild(element_kind, null, root2, 0, null);
    rootMeta.kind = fragment_kind;
    rootMeta.node = globalThis.document.createTextNode("");
    rootMeta.parent = rootNodeMeta;
    rootNodeMeta.children.push(rootMeta);
    root2.insertBefore(rootMeta.node, root2.firstChild);
    return fragment2(toList3(children));
  }
  if (children.length === 1) {
    return children[0][1];
  }
  const placeholder = globalThis.document.createTextNode("");
  insertMetadataChild(text_kind, rootMeta, placeholder, 0, null);
  root2.insertBefore(placeholder, root2.firstChild);
  return none2();
};
var virtualiseChild = (meta2, domParent, child2, index4) => {
  if (child2.nodeType === COMMENT_NODE) {
    const data3 = child2.data.trim();
    if (data3.startsWith("lustre:fragment")) {
      return virtualiseFragment(meta2, domParent, child2, index4);
    }
    if (data3.startsWith("lustre:map")) {
      return virtualiseMap(meta2, domParent, child2, index4);
    }
    if (data3.startsWith("lustre:memo")) {
      return virtualiseMemo(meta2, domParent, child2, index4);
    }
    return null;
  }
  if (child2.nodeType === ELEMENT_NODE) {
    return virtualiseElement(meta2, child2, index4);
  }
  if (child2.nodeType === TEXT_NODE) {
    return virtualiseText(meta2, child2, index4);
  }
  return null;
};
var virtualiseElement = (metaParent, node, index4) => {
  const key = node.getAttribute("data-lustre-key") ?? "";
  if (key) {
    node.removeAttribute("data-lustre-key");
  }
  const meta2 = insertMetadataChild(element_kind, metaParent, node, index4, key);
  const tag = node.localName;
  const namespace = node.namespaceURI;
  const isHtmlElement = !namespace || namespace === NAMESPACE_HTML;
  if (isHtmlElement && INPUT_ELEMENTS.includes(tag)) {
    virtualiseInputEvents(tag, node);
  }
  const attributes = virtualiseAttributes(node);
  const { children } = virtualiseChildren(meta2, node, node.firstChild);
  const vnode = isHtmlElement ? element3(tag, attributes, toList3(children)) : namespaced2(namespace, tag, attributes, toList3(children));
  return childResult(key, vnode, node.nextSibling);
};
var virtualiseChildren = (meta2, domParent, childNode) => {
  const children = [];
  while (childNode && (childNode.nodeType !== COMMENT_NODE || childNode.data.trim() !== "/lustre:fragment")) {
    const child2 = virtualiseChild(meta2, domParent, childNode, children.length);
    if (child2) {
      children.push([child2.key, child2.vnode]);
      childNode = child2.next;
    } else {
      childNode = childNode.nextSibling;
    }
  }
  return { children, end: childNode };
};
var virtualiseText = (meta2, node, index4) => {
  insertMetadataChild(text_kind, meta2, node, index4, null);
  return childResult("", text2(node.data), node.nextSibling);
};
var virtualiseFragment = (metaParent, domParent, node, index4) => {
  const key = parseKey(node.data);
  const meta2 = insertMetadataChild(fragment_kind, metaParent, node, index4, key);
  const { children, end } = virtualiseChildren(meta2, domParent, node.nextSibling);
  meta2.endNode = end;
  const vnode = fragment2(toList3(children));
  return childResult(key, vnode, end?.nextSibling);
};
var virtualiseMap = (metaParent, domParent, node, index4) => {
  const key = parseKey(node.data);
  const meta2 = insertMetadataChild(map_kind, metaParent, node, index4, key);
  const child2 = virtualiseNextChild(meta2, domParent, node, 0);
  if (!child2)
    return null;
  const vnode = map5(child2.vnode, (x) => x);
  return childResult(key, vnode, child2.next);
};
var virtualiseMemo = (meta2, domParent, node, index4) => {
  const key = parseKey(node.data);
  const child2 = virtualiseNextChild(meta2, domParent, node, index4);
  if (!child2)
    return null;
  domParent.removeChild(node);
  const vnode = memo2(toList3([ref({})]), () => child2.vnode);
  return childResult(key, vnode, child2.next);
};
var virtualiseNextChild = (meta2, domParent, node, index4) => {
  while (true) {
    node = node.nextSibling;
    if (!node)
      return null;
    const child2 = virtualiseChild(meta2, domParent, node, index4);
    if (child2)
      return child2;
  }
};
var childResult = (key, vnode, next) => {
  return { key, vnode, next };
};
var virtualiseAttributes = (node) => {
  const attributes = [];
  for (let i = 0;i < node.attributes.length; i++) {
    const attr = node.attributes[i];
    if (attr.name !== "xmlns") {
      attributes.push(attribute2(attr.localName, attr.value));
    }
  }
  return toList3(attributes);
};
var INPUT_ELEMENTS = ["input", "select", "textarea"];
var virtualiseInputEvents = (tag, node) => {
  const value2 = node.value;
  const checked = node.checked;
  if (tag === "input" && node.type === "checkbox" && !checked)
    return;
  if (tag === "input" && node.type === "radio" && !checked)
    return;
  if (node.type !== "checkbox" && node.type !== "radio" && !value2)
    return;
  queueMicrotask(() => {
    node.value = value2;
    node.checked = checked;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    if (globalThis.document.activeElement !== node) {
      node.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  });
};
var parseKey = (data3) => {
  const keyMatch = data3.match(/key="([^"]*)"/);
  if (!keyMatch)
    return "";
  return unescapeKey(keyMatch[1]);
};
var unescapeKey = (key) => {
  return key.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");
};
var toList3 = (arr) => arr.reduceRight((xs, x) => List$NonEmpty(x, xs), empty_list);

// build/dev/javascript/lustre/lustre/runtime/client/runtime.ffi.mjs
var is_browser = () => !!globalThis.document;
class Runtime {
  constructor(root2, [model, effects], view, update2, options) {
    this.root = root2;
    this.#model = model;
    this.#view = view;
    this.#update = update2;
    this.root.addEventListener("context-request", (event3) => {
      if (!(event3.context && event3.callback))
        return;
      if (!this.#contexts.has(event3.context))
        return;
      event3.stopImmediatePropagation();
      const context = this.#contexts.get(event3.context);
      if (event3.subscribe) {
        const unsubscribe2 = () => {
          context.subscribers = context.subscribers.filter((subscriber) => subscriber !== event3.callback);
        };
        context.subscribers.push([event3.callback, unsubscribe2]);
        event3.callback(context.value, unsubscribe2);
      } else {
        event3.callback(context.value);
      }
    });
    const decodeEvent = (event3, path, name) => decode2(this.#cache, path, name, event3);
    const dispatch2 = (event3, data3) => {
      const [cache, result] = dispatch(this.#cache, data3);
      this.#cache = cache;
      if (Result$isOk(result)) {
        const handler = Result$Ok$0(result);
        if (handler.stop_propagation)
          event3.stopPropagation();
        if (handler.prevent_default)
          event3.preventDefault();
        this.dispatch(handler.message, false);
      }
    };
    this.#reconciler = new Reconciler(this.root, decodeEvent, dispatch2, options);
    this.#vdom = virtualise(this.root);
    this.#cache = new$4();
    this.#handleEffects(effects);
    this.#render();
  }
  root = null;
  dispatch(message, shouldFlush = false) {
    if (this.#shouldQueue) {
      this.#queue.push(message);
    } else {
      const [model, effects] = this.#update(this.#model, message);
      this.#model = model;
      this.#scheduleRender(shouldFlush);
      this.#handleEffects(effects);
    }
  }
  emit(event3, data3) {
    const target = this.root.host ?? this.root;
    target.dispatchEvent(new LustreEvent(event3, data3));
  }
  provide(key, value2) {
    if (!this.#contexts.has(key)) {
      this.#contexts.set(key, { value: value2, subscribers: [] });
    } else {
      const context = this.#contexts.get(key);
      if (isEqual2(context.value, value2)) {
        return;
      }
      context.value = value2;
      for (let i = context.subscribers.length - 1;i >= 0; i--) {
        const [subscriber, unsubscribe2] = context.subscribers[i];
        if (!subscriber) {
          context.subscribers.splice(i, 1);
          continue;
        }
        subscriber(value2, unsubscribe2);
      }
    }
  }
  subscribe(key, decoder) {
    if (!key)
      return;
    this.#contextSubscriptions.get(key)?.();
    const target = this.root.host ?? this.root;
    target.dispatchEvent(new ContextRequestEvent(key, (value2, unsubscribe2) => {
      const previousUnsubscribe = this.#contextSubscriptions.get(key);
      if (previousUnsubscribe !== unsubscribe2) {
        previousUnsubscribe?.();
      }
      const decoded = run(value2, decoder);
      this.#contextSubscriptions.set(key, unsubscribe2);
      if (Result$isOk(decoded)) {
        this.dispatch(Result$Ok$0(decoded), true);
      }
    }, true));
  }
  unsubscribe(key) {
    const unsubscribe2 = this.#contextSubscriptions.get(key);
    if (unsubscribe2) {
      unsubscribe2();
      this.#contextSubscriptions.delete(key);
    }
  }
  unsubscribeAll() {
    for (const [_, unsubscribe2] of this.#contextSubscriptions) {
      unsubscribe2?.();
    }
    this.#contextSubscriptions.clear();
  }
  #model;
  #view;
  #update;
  #vdom;
  #cache;
  #reconciler;
  #contexts = new Map;
  #contextSubscriptions = new Map;
  #shouldQueue = false;
  #queue = [];
  #beforePaint = empty_list;
  #afterPaint = empty_list;
  #renderTimer = null;
  #actions = {
    dispatch: (message) => this.dispatch(message),
    emit: (event3, data3) => this.emit(event3, data3),
    select: () => {},
    root: () => this.root,
    provide: (key, value2) => this.provide(key, value2),
    subscribe: (key, decoder) => this.subscribe(key, decoder),
    unsubscribe: (key) => this.unsubscribe(key)
  };
  #scheduleRender(shouldFlush = false) {
    if (this.#renderTimer)
      return;
    if (shouldFlush) {
      this.#renderTimer = "sync";
      queueMicrotask(() => this.#render());
    } else {
      this.#renderTimer = window.requestAnimationFrame(() => this.#render());
    }
  }
  #handleEffects(effects) {
    this.#shouldQueue = true;
    let updateCalledDuringEffects = false;
    while (true) {
      iterate(effects.synchronous, (effect) => effect(this.#actions));
      this.#beforePaint = append4(this.#beforePaint, effects.before_paint);
      this.#afterPaint = append4(this.#afterPaint, effects.after_paint);
      if (!this.#queue.length)
        break;
      const message = this.#queue.shift();
      [this.#model, effects] = this.#update(this.#model, message);
      updateCalledDuringEffects = true;
    }
    this.#shouldQueue = false;
    return updateCalledDuringEffects;
  }
  #handleAsyncEffects(effects) {
    if (this.#handleEffects(effects)) {
      this.#scheduleRender(true);
    }
  }
  #render() {
    this.#renderTimer = null;
    const next = this.#view(this.#model);
    const { patch, cache } = diff(this.#cache, this.#vdom, next);
    this.#cache = cache;
    this.#vdom = next;
    this.#reconciler.push(patch, memos(cache));
    if (List$isNonEmpty(this.#beforePaint)) {
      const effects = makeEffect(this.#beforePaint);
      this.#beforePaint = empty_list;
      queueMicrotask(() => this.#handleAsyncEffects(effects));
    }
    if (List$isNonEmpty(this.#afterPaint)) {
      const effects = makeEffect(this.#afterPaint);
      this.#afterPaint = empty_list;
      window.requestAnimationFrame(() => this.#handleAsyncEffects(effects));
    }
  }
}
function makeEffect(synchronous) {
  return {
    synchronous,
    after_paint: empty_list,
    before_paint: empty_list
  };
}
var copiedStyleSheets = new WeakMap;
class ContextRequestEvent extends Event {
  constructor(context, callback, subscribe2) {
    super("context-request", { bubbles: true, composed: true });
    this.context = context;
    this.callback = callback;
    this.subscribe = subscribe2;
  }
}

class LustreEvent extends CustomEvent {
  isLustreEvent = true;
  constructor(name, detail) {
    super(name, { detail, bubbles: true, composed: true });
  }
}

// build/dev/javascript/lustre/lustre/runtime/client/spa.ffi.mjs
class Spa {
  #runtime;
  constructor(root2, [init, effects], update2, view) {
    this.#runtime = new Runtime(root2, [init, effects], view, update2);
  }
  send(message) {
    if (Message$isEffectDispatchedMessage(message)) {
      this.dispatch(message.message, false);
    } else if (Message$isEffectEmitEvent(message)) {
      this.emit(message.name, message.data);
    } else if (Message$isSystemRequestedShutdown(message)) {}
  }
  dispatch(message) {
    this.#runtime.dispatch(message);
  }
  emit(event3, data3) {
    this.#runtime.emit(event3, data3);
  }
}
var start = ({ init, update: update2, view }, selector, flags) => {
  if (!is_browser())
    return Result$Error(Error$NotABrowser());
  const root2 = selector instanceof HTMLElement ? selector : globalThis.document.querySelector(selector);
  if (!root2)
    return Result$Error(Error$ElementNotFound(selector));
  return Result$Ok(new Spa(root2, init(flags), update2, view));
};

// build/dev/javascript/lustre/lustre/runtime/server/runtime.ffi.mjs
class Runtime2 {
  #model;
  #update;
  #view;
  #config;
  #vdom;
  #cache;
  #providers = make();
  #callbacks = /* @__PURE__ */ new Set;
  constructor(_, init, update2, view, config, start_arguments) {
    const [model, effects] = init(start_arguments);
    this.#model = model;
    this.#update = update2;
    this.#view = view;
    this.#config = config;
    this.#vdom = this.#view(this.#model);
    this.#cache = from_node(this.#vdom);
    this.#handle_effect(effects);
  }
  send(message) {
    if (Message$isClientDispatchedMessage(message)) {
      const { message: message2 } = message2;
      const next = this.#handle_client_message(message2);
      const diff2 = diff(this.#cache, this.#vdom, next);
      this.#vdom = next;
      this.#cache = diff2.cache;
      this.broadcast(reconcile(diff2.patch, memos(diff2.cache)));
    } else if (Message$isClientRegisteredCallback(message)) {
      const { callback } = message;
      this.#callbacks.add(callback);
      callback(mount(this.#config.open_shadow_root, this.#config.adopt_styles, keys(this.#config.attributes), keys(this.#config.properties), keys(this.#config.contexts), this.#providers, this.#vdom, memos(this.#cache)));
      if (Option$isSome(this.#config.on_connect)) {
        this.#dispatch(Option$Some$0(this.#config.on_connect));
      }
    } else if (Message$isClientDeregisteredCallback(message)) {
      const { callback } = message;
      this.#callbacks.delete(callback);
      if (Option$isSome(this.#config.on_disconnect)) {
        this.#dispatch(Option$Some$0(this.#config.on_disconnect));
      }
    } else if (Message$isEffectDispatchedMessage(message)) {
      const { message: message2 } = message2;
      const [model, effect] = this.#update(this.#model, message2);
      const next = this.#view(model);
      const diff2 = diff(this.#cache, this.#vdom, next);
      this.#handle_effect(effect);
      this.#model = model;
      this.#vdom = next;
      this.#cache = diff2.cache;
      this.broadcast(reconcile(diff2.patch, memos(diff2.cache)));
    } else if (Message$isEffectEmitEvent(message)) {
      const { name, data: data3 } = message;
      this.broadcast(emit(name, data3));
    } else if (Message$isEffectProvidedValue(message)) {
      const { key, value: value2 } = message;
      const existing = get(this.#providers, key);
      if (Result$isOk(existing) && isEqual2(Result$Ok$0(existing), value2)) {
        return;
      }
      this.#providers = insert(this.#providers, key, value2);
      this.broadcast(provide(key, value2));
    } else if (Message$isEffectRequestedContextSubscription(message)) {
      const { key, decoder } = message;
      this.broadcast(subscribe(key));
      this.#config.contexts = insert(this.#config.contexts, key, decoder);
    } else if (Message$isEffectRemovedContextSubscription(message)) {
      const { key } = message;
      this.broadcast(unsubscribe(key));
      this.#config.contexts = undefined(this.#config.contexts, key);
    } else if (Message$isSystemRequestedShutdown(message)) {
      this.#model = null;
      this.#update = null;
      this.#view = null;
      this.#config = null;
      this.#vdom = null;
      this.#cache = null;
      this.#providers = null;
      this.#callbacks.clear();
    }
  }
  broadcast(message) {
    for (const callback of this.#callbacks) {
      callback(message);
    }
  }
  #handle_client_message(message) {
    if (ServerMessage$isBatch(message)) {
      const { messages } = message;
      let model = this.#model;
      let effect = none();
      for (let list4 = messages;List$NonEmpty$rest(list4); list4 = List$NonEmpty$rest(list4)) {
        const result = this.#handle_client_message(List$NonEmpty$first(list4));
        if (Result$isOk(result)) {
          model = Result$Ok$0(result)[0];
          effect = batch(toList2([effect, Result$Ok$0(result)[1]]));
          break;
        }
      }
      this.#handle_effect(effect);
      this.#model = model;
      return this.#view(model);
    } else if (ServerMessage$isAttributeChanged(message)) {
      const { name, value: value2 } = message;
      const result = this.#handle_attribute_change(name, value2);
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      return this.#dispatch(Result$Ok$0(result));
    } else if (ServerMessage$isPropertyChanged(message)) {
      const { name, value: value2 } = message;
      const result = this.#handle_properties_change(name, value2);
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      return this.#dispatch(Result$Ok$0(result));
    } else if (ServerMessage$isEventFired(message)) {
      const { path, name, event: event3 } = message2;
      const [cache, result] = handle(this.#cache, path, name, event3);
      this.#cache = cache;
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      const { message: message2 } = Result$Ok$0(result);
      return this.#dispatch(message2);
    } else if (ServerMessage$isContextProvided(message)) {
      const { key, value: value2 } = message;
      let result = get(this.#config.contexts, key);
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      result = run(value2, Result$Ok$0(result));
      if (!Result$isOk(result)) {
        return this.#vdom;
      }
      return this.#dispatch(Result$Ok$0(result));
    }
  }
  #dispatch(message) {
    const [model, effects] = this.#update(this.#model, message);
    this.#handle_effect(effects);
    this.#model = model;
    return this.#view(this.#model);
  }
  #handle_attribute_change(name, value2) {
    const result = get(this.#config.attributes, name);
    if (!Result$isOk(result)) {
      return result;
    }
    return Result$Ok$0(result)(value2);
  }
  #handle_properties_change(name, value2) {
    const result = get(this.#config.properties, name);
    if (!Result$isOk(result)) {
      return result;
    }
    return Result$Ok$0(result)(value2);
  }
  #handle_effect(effect) {
    const dispatch2 = (message) => this.send(Message$EffectDispatchedMessage(message));
    const emit2 = (name, data3) => this.send(Message$EffectEmitEvent(name, data3));
    const select = () => {
      return;
    };
    const internals = () => {
      return;
    };
    const provide2 = (key, value2) => this.send(Message$EffectProvidedValue(key, value2));
    const subscribe2 = (key, decoder) => this.send(Message$EffectRequestedContextSubscription(key, decoder));
    const unsubscribe2 = (key) => this.send(Message$EffectRemovedContextSubscription(key));
    globalThis.queueMicrotask(() => {
      perform(effect, dispatch2, emit2, select, internals, provide2, subscribe2, unsubscribe2);
    });
  }
}

// build/dev/javascript/lustre/lustre.mjs
class ElementNotFound extends CustomType {
  constructor(selector) {
    super();
    this.selector = selector;
  }
}
var Error$ElementNotFound = (selector) => new ElementNotFound(selector);
class NotABrowser extends CustomType {
}
var Error$NotABrowser = () => new NotABrowser;
function application(init, update2, view) {
  return new App(new None, init, update2, view, default_config);
}
function start4(app, selector, arguments$) {
  return guard(!is_browser(), new Error(new NotABrowser), () => {
    return start(app, selector, arguments$);
  });
}

// build/dev/javascript/lustre/lustre/event.mjs
function on(name, handler) {
  return event(name, map3(handler, (message) => {
    return new Handler(false, false, message);
  }), empty_list, never, never, 0, 0);
}
function on_click(message) {
  return on("click", success(message));
}
function on_input(message) {
  return on("input", subfield(toList(["target", "value"]), string2, (value2) => {
    return success(message(value2));
  }));
}
// build/dev/javascript/shared/shared/protocol.mjs
class Peer extends CustomType {
  constructor(id2, display_name) {
    super();
    this.id = id2;
    this.display_name = display_name;
  }
}
class PeerList extends CustomType {
  constructor(peers) {
    super();
    this.peers = peers;
  }
}
class PeerJoined extends CustomType {
  constructor(peer) {
    super();
    this.peer = peer;
  }
}
class PeerLeft extends CustomType {
  constructor(device_id) {
    super();
    this.device_id = device_id;
  }
}
class ErrorEvent extends CustomType {
  constructor(code, message) {
    super();
    this.code = code;
    this.message = message;
  }
}
class UnknownServerEvent extends CustomType {
  constructor(event_type) {
    super();
    this.event_type = event_type;
  }
}
class PeerListEvent extends CustomType {
}

class PeerJoinedEvent extends CustomType {
}

class PeerLeftEvent extends CustomType {
}

class ErrorServerEvent extends CustomType {
}

class UnknownEventType extends CustomType {
  constructor(raw) {
    super();
    this.raw = raw;
  }
}
function encode_peer_hello(device_id, display_name) {
  let _pipe = object2(toList([
    ["type", string3("peer.hello")],
    ["device_id", string3(device_id)],
    ["display_name", string3(display_name)]
  ]));
  return to_string2(_pipe);
}
function classify_server_event_type(event_type) {
  if (event_type === "peer.list") {
    return new PeerListEvent;
  } else if (event_type === "peer.joined") {
    return new PeerJoinedEvent;
  } else if (event_type === "peer.left") {
    return new PeerLeftEvent;
  } else if (event_type === "error") {
    return new ErrorServerEvent;
  } else {
    let other = event_type;
    return new UnknownEventType(other);
  }
}
function result_nil_error(result) {
  if (result instanceof Ok) {
    return result;
  } else {
    return new Error(undefined);
  }
}
function peer_decoder() {
  return field("id", string2, (id2) => {
    return field("display_name", string2, (display_name) => {
      return success(new Peer(id2, display_name));
    });
  });
}
function peer_list_decoder() {
  return list2(peer_decoder());
}
function decode_known_server_event(input2, event_type) {
  let _block;
  if (event_type instanceof PeerListEvent) {
    let decoder = field("peers", peer_list_decoder(), (peers) => {
      return success(new PeerList(peers));
    });
    _block = parse(input2, decoder);
  } else if (event_type instanceof PeerJoinedEvent) {
    let decoder = field("peer", peer_decoder(), (peer) => {
      return success(new PeerJoined(peer));
    });
    _block = parse(input2, decoder);
  } else if (event_type instanceof PeerLeftEvent) {
    let decoder = field("device_id", string2, (device_id) => {
      return success(new PeerLeft(device_id));
    });
    _block = parse(input2, decoder);
  } else if (event_type instanceof ErrorServerEvent) {
    let decoder = field("code", string2, (code) => {
      return field("message", string2, (message) => {
        return success(new ErrorEvent(code, message));
      });
    });
    _block = parse(input2, decoder);
  } else {
    let raw = event_type.raw;
    _block = new Ok(new UnknownServerEvent(raw));
  }
  let _pipe = _block;
  return result_nil_error(_pipe);
}
function decode_server_event(input2) {
  let event_type_decoder = field("type", string2, (event_type) => {
    return success(event_type);
  });
  let $ = parse(input2, event_type_decoder);
  if ($ instanceof Ok) {
    let event_type = $[0];
    return decode_known_server_event(input2, classify_server_event_type(event_type));
  } else {
    return new Error(undefined);
  }
}

// build/dev/javascript/client/ffi.mjs
var socket = null;
function loadIdentity() {
  let deviceId = localStorage.getItem("glim.device_id");
  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = "device_" + Math.random().toString(36).slice(2);
    }
    localStorage.setItem("glim.device_id", deviceId);
  }
  return {
    device_id: deviceId,
    display_name: localStorage.getItem("glim.display_name") || "Glim Peer"
  };
}
function connect(displayName, helloJson, onOpen, onClose, onError, onMessage) {
  localStorage.setItem("glim.display_name", displayName);
  if (socket) {
    socket.close();
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(protocol + "//" + location.host + "/ws");
  socket.addEventListener("open", function() {
    socket.send(helloJson);
    onOpen();
  });
  socket.addEventListener("message", function(event4) {
    if (typeof event4.data === "string") {
      onMessage(event4.data);
    }
  });
  socket.addEventListener("close", function() {
    onClose();
  });
  socket.addEventListener("error", function() {
    onError();
  });
}
// build/dev/javascript/client/browser.mjs
function load_identity(to_message) {
  return from2((dispatch2) => {
    let _pipe = loadIdentity();
    let _pipe$1 = to_message(_pipe);
    return dispatch2(_pipe$1);
  });
}
function connect2(display_name, hello_json, on_open, on_close, on_error, on_message) {
  return from2((dispatch2) => {
    return connect(display_name, hello_json, () => {
      return dispatch2(on_open);
    }, () => {
      return dispatch2(on_close);
    }, () => {
      return dispatch2(on_error);
    }, (raw) => {
      let _pipe = raw;
      let _pipe$1 = on_message(_pipe);
      return dispatch2(_pipe$1);
    });
  });
}

// build/dev/javascript/client/client.mjs
var FILEPATH = "src/client.gleam";

class Model extends CustomType {
  constructor(device_id, display_name, status, peers, log2) {
    super();
    this.device_id = device_id;
    this.display_name = display_name;
    this.status = status;
    this.peers = peers;
    this.log = log2;
  }
}

class Disconnected extends CustomType {
}

class Connected extends CustomType {
}

class ConnectionError extends CustomType {
}

class UserTypedDisplayName extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class UserClickedConnect extends CustomType {
}

class BrowserLoadedIdentity extends CustomType {
  constructor(device_id, display_name) {
    super();
    this.device_id = device_id;
    this.display_name = display_name;
  }
}

class WebSocketOpened extends CustomType {
}

class WebSocketClosed extends CustomType {
}

class WebSocketFailed extends CustomType {
}

class WebSocketReceived extends CustomType {
  constructor(raw) {
    super();
    this.raw = raw;
  }
}
function view_peer(peer) {
  return li(toList([data2("device-id", peer.id)]), toList([text3(peer.display_name + " (" + peer.id + ")")]));
}
function status_text(status) {
  if (status instanceof Disconnected) {
    return "Disconnected";
  } else if (status instanceof Connected) {
    return "Connected";
  } else {
    return "Connection error";
  }
}
function view(model) {
  return main(toList([]), toList([
    h1(toList([]), toList([text3("LAN Share IM")])),
    p(toList([]), toList([
      text3("Lustre full-stack slice: connect and view LAN presence.")
    ])),
    label(toList([for$("display-name")]), toList([text3("Display name")])),
    input(toList([
      id("display-name"),
      maxlength(64),
      autocomplete("name"),
      value(model.display_name),
      on_input((var0) => {
        return new UserTypedDisplayName(var0);
      })
    ])),
    button(toList([
      id("connect-button"),
      type_("button"),
      on_click(new UserClickedConnect)
    ]), toList([text3("Connect")])),
    p(toList([id("status")]), toList([text3(status_text(model.status))])),
    h2(toList([class$("text-3xl font-bold underline")]), toList([text3("Peers")])),
    ul(toList([id("peers")]), (() => {
      let _pipe = model.peers;
      return map2(_pipe, view_peer);
    })()),
    h2(toList([]), toList([text3("Event log")])),
    pre(toList([id("log")]), toList([
      text3((() => {
        let _pipe = model.log;
        return join(_pipe, `
`);
      })())
    ]))
  ]));
}
function remove_peer(peers, device_id) {
  let _pipe = peers;
  return filter(_pipe, (peer) => {
    return peer.id !== device_id;
  });
}
function upsert_peer(peers, peer) {
  let _block;
  let _pipe = peers;
  _block = map2(_pipe, (existing) => {
    let $2 = existing.id === peer.id;
    if ($2) {
      return peer;
    } else {
      return existing;
    }
  });
  let replaced = _block;
  let $ = (() => {
    let _pipe$1 = peers;
    return any(_pipe$1, (existing) => {
      return existing.id === peer.id;
    });
  })();
  if ($) {
    return replaced;
  } else {
    return append2(peers, toList([peer]));
  }
}
function handle_server_event(model, raw) {
  let log2 = append2(model.log, toList([raw]));
  let $ = decode_server_event(raw);
  if ($ instanceof Ok) {
    let $1 = $[0];
    if ($1 instanceof PeerList) {
      let peers = $1.peers;
      return [
        new Model(model.device_id, model.display_name, model.status, peers, log2),
        none()
      ];
    } else if ($1 instanceof PeerJoined) {
      let peer = $1.peer;
      return [
        new Model(model.device_id, model.display_name, model.status, upsert_peer(model.peers, peer), log2),
        none()
      ];
    } else if ($1 instanceof PeerLeft) {
      let device_id = $1.device_id;
      return [
        new Model(model.device_id, model.display_name, model.status, remove_peer(model.peers, device_id), log2),
        none()
      ];
    } else if ($1 instanceof ErrorEvent) {
      return [
        new Model(model.device_id, model.display_name, model.status, model.peers, log2),
        none()
      ];
    } else {
      return [
        new Model(model.device_id, model.display_name, model.status, model.peers, log2),
        none()
      ];
    }
  } else {
    return [
      new Model(model.device_id, model.display_name, model.status, model.peers, append2(log2, toList(["Unable to parse server event"]))),
      none()
    ];
  }
}
function normalized_display_name(display_name) {
  let $ = trim(display_name);
  if ($ === "") {
    return "Glim Peer";
  } else {
    return $;
  }
}
function update2(model, message) {
  if (message instanceof UserTypedDisplayName) {
    let name = message[0];
    return [
      new Model(model.device_id, name, model.status, model.peers, model.log),
      none()
    ];
  } else if (message instanceof UserClickedConnect) {
    let name = normalized_display_name(model.display_name);
    let hello_json = encode_peer_hello(model.device_id, name);
    return [
      new Model(model.device_id, name, model.status, model.peers, model.log),
      connect2(name, hello_json, new WebSocketOpened, new WebSocketClosed, new WebSocketFailed, (var0) => {
        return new WebSocketReceived(var0);
      })
    ];
  } else if (message instanceof BrowserLoadedIdentity) {
    let device_id = message.device_id;
    let display_name = message.display_name;
    return [
      new Model(device_id, display_name, model.status, model.peers, model.log),
      none()
    ];
  } else if (message instanceof WebSocketOpened) {
    return [
      new Model(model.device_id, model.display_name, new Connected, model.peers, model.log),
      none()
    ];
  } else if (message instanceof WebSocketClosed) {
    return [
      new Model(model.device_id, model.display_name, new Disconnected, model.peers, model.log),
      none()
    ];
  } else if (message instanceof WebSocketFailed) {
    return [
      new Model(model.device_id, model.display_name, new ConnectionError, model.peers, model.log),
      none()
    ];
  } else {
    let raw = message.raw;
    return handle_server_event(model, raw);
  }
}
function init(_) {
  return [
    new Model("", "Glim Peer", new Disconnected, toList([]), toList([])),
    load_identity((identity4) => {
      return new BrowserLoadedIdentity(identity4.device_id, identity4.display_name);
    })
  ];
}
function main2() {
  let app = application(init, update2, view);
  let $ = start4(app, "#app", undefined);
  if (!($ instanceof Ok)) {
    throw makeError("let_assert", FILEPATH, "client", 14, "main", "Pattern match failed, no pattern matched the value.", { value: $, start: 329, end: 378, pattern_start: 340, pattern_end: 345 });
  }
  return;
}

// .lustre/build/client.mjs
main2();
