import stdlib from "./like.json" assert { type: "json" };

import type {
  And,
  Behavior,
  Declaration,
  Field,
  Inferred,
  KeysFrom,
  Or,
  Pattern,
  Registrations,
  Registry,
  Schema,
} from "./like-inferred.d.ts";

// TODO: beg for export type * from ""; https://github.com/microsoft/TypeScript/issues/37238
export type {
  And,
  Behavior,
  Declaration,
  Field,
  Inferred,
  KeysFrom,
  Or,
  Pattern,
  Registrations,
  Registries,
  Registry,
  Schema,
} from "./like-inferred.d.ts";

const isDataView = function (this: () => any, val: any): val is DataView {
  return this.call(val) === "[object DataView]";
}.bind(Object.prototype.toString);

export const isKeylike = (key: unknown): key is keyof any => {
  switch (typeof key) {
    default: {
      return false;
    }

    case "string":
    case "number":
    case "symbol": {
      return true;
    }
  }
};

export const isKeyof = <K extends keyof any, T>(
  target: undefined | T,
  key: undefined | K,
): target is T & { [P in K]: unknown } => {
  if (!isKeylike(key)) return false;
  else return target && typeof target === "object" ? key in target : false;
};

export const likeKeyof = <K extends keyof V | undefined, V extends {}>(
  target: V,
  key: K extends keyof V ? keyof V : K | keyof V,
) => {
  return key;
};

export const likeValid = maybeValid;

function maybeValid<
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
  V extends Inferred<R, T>,
>(use: R, nameOrSchema: T, value: V): V;

function maybeValid<
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
>(use: R, nameOrSchema: T): Inferred<R, T> | undefined;

function maybeValid<
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
  V extends Inferred<R, T>,
>(use: R, nameOrSchema: T, value?: V) {
  return value;
}

type UnaryLike<T> = (<V extends T>(v: V) => V) & (() => undefined | T);

export const likeSchema: UnaryLike<Schema> = function () {
  return arguments.length ? arguments[0] : undefined;
};
export const likeRegistry: UnaryLike<Registry> = function () {
  return arguments.length ? arguments[0] : undefined;
};
export const likeBehavior: UnaryLike<Behavior> = function () {
  return arguments.length ? arguments[0] : undefined;
};
export const likePattern = <UnaryLike<Pattern>> function () {
  return arguments.length ? arguments[0] : undefined;
};

const identity = function () {
  return arguments.length ? arguments[0] : undefined;
};
// TODO: analyze this pass-through approach for potential "megamorphic" impacts...
export const likeField = <UnaryLike<Field>> identity;
export const likeDeclaration: UnaryLike<Declaration> = identity;

export const asUnsafe = <
  T extends Schema | KeysFrom<R>,
  R extends Registrations | undefined,
>(
  target: unknown,
  nameOrSchema?: T,
  use?: R,
): target is Inferred<R, T> => true;

const resolveSchema = <
  T extends Schema | KeysFrom<R>,
  R extends Registrations | undefined,
>(nameOrSchema: T, use: R): Schema | undefined => {
  if (!isKeylike(nameOrSchema)) {
    return nameOrSchema;
  } else if (Array.isArray(use)) {
    for (let index = 0; index < use.length; index += 1) {
      const reg = use[index];
      if (isKeyof(reg, nameOrSchema)) {
        return reg[nameOrSchema].type;
      }
    }
  } else if (isKeyof(use, nameOrSchema)) {
    return use[nameOrSchema].type;
  }

  return undefined;
};

// TODO: determine why typeof schema["_"] provides insufficient inference...
const isTrivialSchema = (schema: Schema): schema is Pattern => {
  return typeof schema["_"] === "string";
};
const isAndSchema = (schema: Schema): schema is And => {
  return Array.isArray(schema["_"]);
};

export const isValid = <
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
>(
  use: R,
  nameOrSchema: T,
  target: unknown,
  height = 256,
): target is Inferred<R, T> => {
  return !notValid(target, nameOrSchema, use, height, new Set(), null);
};

const notValid = <
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
>(
  target: unknown,
  nameOrSchema: T,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  if (height < 1) throw new Error("Like: permitted traversal depth exceeded.");

  const match = resolveSchema(nameOrSchema, use);

  if (match === null || typeof match !== "object") {
    return "Like: could not resolve schema object.\n";
  }

  if (!isTrivialSchema(match)) {
    if (isAndSchema(match)) {
      return notAndMatch(target, match, use, height, saw, cache);
    } else {
      return notOrMatch(target, match, use, height, saw, cache);
    }
  }

  if (saw) {
    if (saw.has(target)) throw new Error("Like: will not allow circular refs.");

    saw.add(target);
  }

  const reason = notDirectMatch(target, match, use, height, saw, cache);

  if (saw) saw.delete(target);

  if (!reason) return "";

  const absolutely = notIndirectMatch(target, match, use, height, saw, cache);

  return absolutely ? reason + absolutely : "";
};

const notAndMatch = <R extends Registrations | undefined>(
  target: unknown,
  match: And,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  let aggregate = "";
  const codes = Object.keys(match);

  for (let index = 0; index < codes.length; index += 1) {
    const key = codes[index];

    if (key === "" || key === "_") continue;

    const value = match[key];
    const reason = notValid(target, value, use, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Or validation failed.\n";
  }

  return aggregate;
};

const notOrMatch = <R extends Registrations | undefined>(
  target: unknown,
  match: Or,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  let aggregate = "";
  const exhaustive = false;
  const codes = Object.keys(match);

  for (let index = 0; index < codes.length; index += 1) {
    const key = codes[index];

    if (key === "" || key === "_") continue;

    const value = match[key];
    const reason = notValid(target, value[key], use, height - 1, saw, cache);
    if (!reason) continue;
    aggregate += reason + "Like: And validation failed.\n";
    if (!exhaustive) break;
  }

  return aggregate;
};

const notDirectMatch = <R extends Registrations | undefined>(
  target: unknown,
  match: Pattern,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  switch (typeof target) {
    default: {
      return "Like: unrecognized typeof value.\n";
    }

    case "function": {
      return notFunctionMatch(target, match);
    }

    case "boolean": {
      return notBooleanMatch(target, match);
    }
    case "bigint": {
      return notBigIntMatch(target, match);
    }
    case "number": {
      return notNumberMatch(target, match);
    }
    case "string": {
      return notStringMatch(target, match);
    }

    case "object": {
      if (target === null) {
        return notNullMatch(target, match);
      } else if (ArrayBuffer.isView(target)) {
        return notViewMatch(target, match);
      } else if (Array.isArray(target)) {
        return notArrayMatch(target, match, use, height, saw, cache);
      } else if (typeof target === "object") {
        return notObjectMatch(target, match, use, height, saw, cache);
      } else {
        return "Like: validator panicked.\n";
      }
    }
  }
};

const notFunctionMatch = (target: Function, match: Pattern): string => {
  if (typeof match["method"] === "object") {
    const { ts } = match["method"];
    if (ts) return "";
  }

  return "Like: function is not valid.\n";
};

const notBooleanMatch = (target: boolean, match: Pattern): string => {
  if (typeof match["boolean"] !== "object") {
    return "Like: boolean is not valid.\n";
  }

  const { always } = match["boolean"];

  if (!always) return "";

  if (always.true) {
    return target === true ? "" : "Like: boolean must be true.\n";
  }

  if (always.false) {
    return target === false ? "" : "Like: boolean must be false.\n";
  }

  return "";
};

const notBigIntMatch = (target: bigint, match: Pattern): string => {
  if (typeof match["int"] !== "object") {
    return "Like: bigint is not valid.\n";
  }

  // TODO: "depth"
  // TODO: "enums"
  const { safe, depth, enums } = match["int"];

  if (typeof safe !== "object") return "";
  if (target > Number.MAX_SAFE_INTEGER) {
    return "Like: bigint is not safe.\n";
  }
  if (target < Number.MIN_SAFE_INTEGER) {
    return "Like: bigint is not safe.\n";
  }

  return "";
};

const notNumberMatch = (target: number, match: Pattern): string => {
  // TODO: "depth"
  // TODO: "enums"
  let float = true;

  if (typeof match["float"] !== "object") {
    if (typeof match["int"] !== "object") {
      return "Like: number is not valid.\n";
    }
    float = false;
  } else if (typeof match["float"].safe === "object") {
    float = typeof match["float"].safe.integer !== "object";
  } else {
    if (Number.isFinite(target)) "";
    return "Like: number is not finite.\n";
  }

  if (target > Number.MAX_SAFE_INTEGER) {
    return "Like: number is not safe.\n";
  }
  if (target < Number.MIN_SAFE_INTEGER) {
    return "Like: number is not safe.\n";
  }

  if (float) {
    if (!Number.isNaN(target)) return "";
    return "Like: number isNaN.\n";
  }

  if (target === Math.floor(target)) return "";
  return "Like: number is not integer.\n";
};

const notStringMatch = (target: string, match: Pattern): string => {
  if (typeof match["string"] !== "object") {
    return "Like: string is not valid.\n";
  }

  const { enums } = match["string"];

  if (enums && typeof enums[target] !== "object") {
    return "Like: string enum failed validation.\n";
  }

  return "";
};

const notNullMatch = (target: null, match: Pattern): string => {
  if (typeof match["null"] === "object") return "";
  return "Like: null is not valid.\n";
};

const notViewMatch = (target: ArrayBufferView, match: Pattern): string => {
  if (typeof match["data"] === "object" && isDataView(target)) return "";
  return "Like: buffer-view is not valid.\n";
};

const notArrayMatch = <R extends Registrations | undefined>(
  target: Array<any>,
  match: Pattern,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  if (typeof match["array"] !== "object") {
    return "Like: array is not valid.\n";
  }

  const { items, prefix } = match["array"];
  const suffix = typeof items === "object";
  let rest = !prefix;

  if (items || prefix) {
    for (let index = 0; index < target.length; index += 1) {
      const entry = !rest && prefix ? prefix[index] : undefined;

      if (entry && typeof entry.type === "object") {
        const next = target[index];
        const { type } = entry;

        const reason = notValid(next, type, use, height - 1, saw, cache);
        if (!reason) continue;
        return reason + "Like: tuple prefix " + index + " invalid.\n";
      } else if (suffix) {
        const next = target[index];
        const { type } = items;
        rest = true;

        const reason = notValid(next, type, use, height - 1, saw, cache);
        if (!reason) continue;
        return prefix
          ? reason + "Like: tuple suffix " + index + " invalid.\n"
          : reason + "Like: array item " + index + " invalid.\n";
      }
    }
  }

  return "";
};

const notObjectMatch = <R extends Registrations | undefined>(
  target: object,
  match: Pattern,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  if (typeof match["object"] !== "object") {
    return "Like: object is not valid.\n";
  }

  const { values, fields } = match["object"];

  if (fields && typeof fields === "object") {
    const props = Object.keys(fields);

    let count = 0;
    let mutex = false;
    let optional = false;

    for (let index = 0; index < props.length; index += 1) {
      const label = props[index];
      const entry = fields[label];

      if (entry && typeof entry.mutex === "object") {
        mutex = true;
        if (
          isKeyof(target, label) && (target[label] ?? null) !== null
        ) {
          count += 1;
          if (count > 1) break;
        } else if (typeof entry.optional === "object") {
          optional = true;
        }
      }
    }

    if (mutex) {
      if (count > 1 || count === 0 && !optional) {
        return "Like: mutex validation failed.\n";
      }
    }

    for (let index = 0; index < props.length; index += 1) {
      const label = props[index];
      const entry = fields[label];

      if (entry && typeof entry.type === "object") {
        if (
          isKeyof(target, label) && (target[label] ?? null) !== null
        ) {
          const next = target[label];
          const { type } = entry;

          const reason = notValid(next, type, use, height - 1, saw, cache);
          if (!reason) continue;
          return reason + "Like: object field " + index + " invalid.\n";
        } else {
          if (typeof entry.optional === "object") continue;
          if (typeof entry.mutex === "object") continue;
          return "Like: object field " + index + " missing.\n";
        }
      }
    }

    if (typeof values === "object") {
      const keys = Object.keys(target);

      for (let index = 0; index < keys.length; index += 1) {
        const label = keys[index];

        if (!fields[label]) {
          const next = target[label];
          const { type } = values;

          const reason = notValid(next, type, use, height - 1, saw, cache);
          if (!reason) continue;
          return reason + "Like: object value " + index + " invalid.\n";
        }
      }
    }
  } else if (values && typeof values === "object") {
    const keys = Object.keys(target);

    for (let index = 0; index < keys.length; index += 1) {
      const label = keys[index];
      const next = target[label];
      const { type } = values;

      const reason = notValid(next, type, use, height - 1, saw, cache);
      if (!reason) continue;
      return reason + "Like: object entry " + index + " invalid.\n";
    }
  }

  return "";
};

const notIndirectMatch = <R extends Registrations | undefined>(
  target: unknown,
  match: Pattern,
  use: R,
  height: number,
  saw: null | Set<unknown>,
  cache: null | Map<unknown, Set<Schema>>,
  // budget: number, // TODO: limit total number of comparisons
): string => {
  if (!match["like"]) {
    return "Like: likenesses are not valid.\n";
  }

  const like = match["like"];
  let aggregate = "";

  if (like.pattern) {
    const { type } = stdlib.Pattern;
    const reason = notValid(target, type, stdlib, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Pattern validation failed.\n";
  }

  if (like.field) {
    const { type } = stdlib.Field;
    const reason = notValid(target, type, stdlib, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Field<optional> validation failed.\n";
  }

  if (like.declaration) {
    const { type } = stdlib.Declaration;
    const reason = notValid(target, type, stdlib, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Field<required> validation failed.\n";
  }

  if (like.behavior) {
    const { type } = stdlib.Behavior;
    const reason = notValid(target, type, stdlib, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Behavior validation failed.\n";
  }

  if (like.schema) {
    const { type } = stdlib.Schema;
    const reason = notValid(target, type, stdlib, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Schema validation failed.\n";
  }

  if (like.registry) {
    const { type } = stdlib.Registry;
    const reason = notValid(target, type, stdlib, height - 1, saw, cache);
    if (!reason) return "";
    aggregate += reason + "Like: Registry validation failed.\n";
  }

  if (like.valid) {
    const { valid } = like;
    const keys = Object.keys(valid);

    for (let index = 0; index < keys.length; index += 1) {
      const label = keys[index];

      if (!valid[label]) continue;

      // type assertion here because "T extends KeysFrom<R>" gives better auto-complete hints than string
      // (and because this is a more _obvious_ lie than "label as KeysFrom<R>")
      const name = label as never;
      const reason = notValid(target, name, use, height - 1, saw, cache);
      if (!reason) return "";
      aggregate += reason + "Like: Valid<T> validation failed.\n";
    }
  }

  return aggregate + "Like: post-like validation failed.\n";
};

type IsValid<T> = (val: unknown, height?: number) => val is T;
// TODO: confirm if [T] extends [infer V] is needed (distributed types?)

export const isSchema = <IsValid<Schema>> (
  isValid.bind(null, stdlib, stdlib.Schema.type)
);
export const isRegistry = <IsValid<Registry>> (
  isValid.bind(null, stdlib, stdlib.Registry.type)
);
export const isBehavior = <IsValid<Behavior>> (
  isValid.bind(null, stdlib, stdlib.Behavior.type)
);

export const isPattern = <IsValid<Pattern>> (
  isValid.bind(null, stdlib, stdlib.Pattern.type)
);
export const isField = <IsValid<Field>> (
  isValid.bind(null, stdlib, stdlib.Field.type)
);
export const isDeclaration = <IsValid<Declaration>> (
  isValid.bind(null, stdlib, stdlib.Declaration.type)
);
