import stdlib from "./like.json" assert { type: "json" };

import type {
  Behavior,
  Declaration,
  Field,
  Inferred,
  KeysFrom,
  Pattern,
  Registrations,
  Registry,
  Schema,
} from "./like-inferred.d.ts";

// TODO: beg for export type * from ""; https://github.com/microsoft/TypeScript/issues/37238
export type {
  KeysFrom,
  Registrations,
  Registries,
  Registry,
  Schema,
  And,
  Or,
  Pattern,
  Behavior,
  Declaration,
  Field,
  Inferred,
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

// TODO: determine why typeof schema["_"] provides insufficient inference...
const isTrivial = (schema: Schema): schema is Pattern => {
  return typeof schema["_"] === "string";
};

const GOTO = Symbol();

export const isValid = <
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
>(
  use: R,
  nameOrSchema: T,
  target: unknown,
  budget: number = 64, // TODO: limit traversal depth and/or breadth (BinaryIs<>/TertiaryIs<>?)
  // TODO: consider handling circular structures... (and then virtualizing the callstack to prevent overflow)
): target is Inferred<R, T> => {
  return !reject(null, use, nameOrSchema, target, budget);
};

const reject = <
  R extends Registrations | undefined,
  T extends Schema | KeysFrom<R>,
>(
  yields: Array<string> | null,
  use: R,
  nameOrSchema: T,
  target: unknown,
  budget: number = 64,
): number => {
  let match: Schema | undefined = undefined;

  if (!isKeylike(nameOrSchema)) {
    match = nameOrSchema;
  } else if (Array.isArray(use)) {
    for (let index = 0; index < use.length; index += 1) {
      const reg = use[index];
      if (isKeyof(reg, nameOrSchema)) {
        match = reg[nameOrSchema].type;
        break;
      }
    }
  } else if (isKeyof(use, nameOrSchema)) {
    match = use[nameOrSchema].type;
  }

  if (match === null || typeof match !== "object") {
    return yields?.push("Like: could not resolve schema object.") ?? 1;
  }

  if (!isTrivial(match)) {
    const codes = Object.keys(match);

    if (Array.isArray(match._)) {
      for (let index = 0; index < codes.length; index += 1) {
        const key = codes[index];

        if (key === "" || key === "_") continue;

        const value = match[key];

        if (!reject(yields, use, value, target, budget)) {
          return (0);
        }
        yields?.push("Like: Or validation failed.");
      }
    } else {
      for (let index = 0; index < codes.length; index += 1) {
        const key = codes[index];

        if (key === "" || key === "_") continue;

        const value = match[key];

        if (reject(yields, use, value[key], target, budget)) {
          if (!yields) return 1;
          yields?.push("Like: And validation failed.");
        }
      }

      if (!yields?.length) return (0);
    }

    return yields?.push("Like: Logical validation failed.") ?? 1;
  }

  try {
    switch (typeof target) {
      default: {
        yields?.push("Like: unrecognized typeof value.");
        throw GOTO;
      }

      case "function": {
        if (typeof match["like"] === "object") {
          if (typeof match["like"]["behavior"] === "object") {
            return (0);
          }
        }
        yields?.push("Like: function is not valid.");
        throw GOTO;
      }

      case "boolean": {
        if (typeof match["boolean"] !== "object") {
          yields?.push("Like: boolean is not valid.");
          throw GOTO;
        }
        return (0);
      }
      case "bigint": {
        if (typeof match["int"] !== "object") {
          yields?.push("Like: bigint is not valid.");
          throw GOTO;
        }

        // TODO: "depth"
        // TODO: "enums"
        const { safe, depth, enums } = match["int"];

        if (typeof safe !== "object") return (0);
        if (target > Number.MAX_SAFE_INTEGER) {
          yields?.push("Like: bigint is not safe.");
          throw GOTO;
        }
        if (target < Number.MIN_SAFE_INTEGER) {
          yields?.push("Like: bigint is not safe.");
          throw GOTO;
        }
        return (0);
      }
      case "number": {
        // TODO: "depth"
        // TODO: "enums"
        let float = true;

        if (typeof match["float"] !== "object") {
          if (typeof match["int"] !== "object") {
            yields?.push("Like: number is not valid.");
            throw GOTO;
          }
          float = false;
        } else if (typeof match["float"].safe === "object") {
          float = typeof match["float"].safe.integer !== "object";
        } else {
          if (Number.isFinite(target)) return (0);
          yields?.push("Like: number is not finite.");
          throw GOTO;
        }

        if (target > Number.MAX_SAFE_INTEGER) {
          yields?.push("Like: number is not safe.");
          throw GOTO;
        }
        if (target < Number.MIN_SAFE_INTEGER) {
          yields?.push("Like: number is not safe.");
          throw GOTO;
        }

        if (float) {
          if (!Number.isNaN(target)) return (0);
          yields?.push("Like: number isNaN.");
          throw GOTO;
        }

        if (target === Math.floor(target)) return (0);
        yields?.push("Like: number is not integer.");
        throw GOTO;
      }

      case "object": {
        if (target === null) {
          if (typeof match["null"] === "object") return (0);
          yields?.push("Like: null is not valid.");
          throw GOTO;
        } else if (ArrayBuffer.isView(target)) {
          if (typeof match["data"] === "object" && isDataView(target)) {
            return (0);
          }
          yields?.push("Like: buffer-view is not valid.");
          throw GOTO;
        } else if (Array.isArray(target)) {
          if (typeof match["array"] !== "object") {
            yields?.push("Like: array is not valid.");
            throw GOTO;
          }

          const { items, prefix } = match["array"];
          const suffix = typeof items === "object";
          let rest = !prefix;

          if (items || prefix) {
            for (let index = 0; index < target.length; index += 1) {
              const entry = !rest && prefix ? prefix[index] : undefined;

              if (entry && typeof entry.type === "object") {
                if (reject(yields, use, entry.type, target[index], budget)) {
                  yields?.push("Like: tuple prefix " + index + " invalid.");
                  throw GOTO;
                }
              } else if (suffix) {
                rest = true;
                if (reject(yields, use, items.type, target[index], budget)) {
                  if (prefix) {
                    yields?.push("Like: tuple suffix " + index + " invalid.");
                  } else {
                    yields?.push("Like: array item " + index + " invalid.");
                  }
                  throw GOTO;
                }
              }
            }
          }

          return (0);
        } else if (typeof target === "object") {
          if (typeof match["object"] !== "object") {
            yields?.push("Like: object is not valid.");
            throw GOTO;
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
                yields?.push("Like: mutex validation failed.");
                throw GOTO;
              }
            }

            for (let index = 0; index < props.length; index += 1) {
              const label = props[index];
              const entry = fields[label];

              if (entry && typeof entry.type === "object") {
                if (
                  isKeyof(target, label) && (target[label] ?? null) !== null
                ) {
                  if (reject(yields, use, entry.type, target[label], budget)) {
                    yields?.push("Like: object field " + index + " invalid.");
                    throw GOTO;
                  }
                } else {
                  if (typeof entry.optional === "object") continue;
                  if (typeof entry.mutex === "object") continue;
                  yields?.push("Like: object field " + index + " missing.");
                  throw GOTO;
                }
              }
            }

            if (typeof values === "object") {
              const keys = Object.keys(target);

              for (let index = 0; index < keys.length; index += 1) {
                const label = keys[index];

                if (!fields[label]) {
                  if (reject(yields, use, values.type, target[label], budget)) {
                    yields?.push("Like: object value " + index + " invalid.");
                    throw GOTO;
                  }
                }
              }
            }

            return (0);
          } else if (values && typeof values === "object") {
            const keys = Object.keys(target);

            for (let index = 0; index < keys.length; index += 1) {
              const label = keys[index];

              if (reject(yields, use, values.type, target[label], budget)) {
                yields?.push("Like: object entry " + index + " invalid.");
                throw GOTO;
              }
            }

            return (0);
          } else {
            return (0);
          }
        } else {
          yields?.push("Like: validator panicked.");
          throw GOTO;
        }
      }

      case "string": {
        if (typeof match["string"] !== "object") {
          yields?.push("Like: string is not valid.");
          throw GOTO;
        }
        const { enums } = match["string"];
        const raw = typeof target === "string" ? target : String(target);

        if (enums && typeof enums[raw] !== "object") {
          yields?.push("Like: string enum failed validation.");
          throw GOTO;
        }

        return (0);
      }
    }
  } catch (err) {
    if (err !== GOTO) throw err;

    if (!match["like"]) {
      return yields?.push("Like: pre-like validation failed.") ?? 1;
    }

    const like = match["like"];

    if (like.pattern) {
      if (!reject(yields, stdlib, stdlib.Pattern.type, target, budget)) {
        return (0);
      }
      yields?.push("Like: Pattern validation failed.");
    }

    if (like.field) {
      if (!reject(yields, stdlib, stdlib.Field.type, target, budget)) {
        return (0);
      }
      yields?.push("Like: Field<optional> validation failed.");
    }

    if (like.declaration) {
      if (!reject(yields, stdlib, stdlib.Declaration.type, target, budget)) {
        return (0);
      }
      yields?.push("Like: Field<required> validation failed.");
    }

    if (like.behavior) {
      if (!reject(yields, stdlib, stdlib.Behavior.type, target, budget)) {
        return (0);
      }
      yields?.push("Like: Behavior validation failed.");
    }

    if (like.schema) {
      if (!reject(yields, stdlib, stdlib.Schema.type, target, budget)) {
        return (0);
      }
      yields?.push("Like: Schema validation failed.");
    }

    if (like.registry) {
      if (!reject(yields, stdlib, stdlib.Registry.type, target, budget)) {
        return (0);
      }
      yields?.push("Like: Registry validation failed.");
    }

    if (like.valid) {
      const { valid } = like;
      const keys = Object.keys(valid);

      for (let index = 0; index < keys.length; index += 1) {
        const label = keys[index];

        if (!valid[label]) continue;

        // type assertion here because "T extends KeysFrom<R>" gives better auto-complete hints than string
        // (and because this is a more _obvious_ lie than "label as KeysFrom<R>")
        if (!reject(yields, use, label as never, target, budget)) {
          return (0);
        }
        yields?.push("Like: Valid<T> validation failed.");
      }
    }

    return yields?.push("Like: post-like validation failed.") ?? 1;
  }
};

type BinaryIs<T> = (val: unknown, budget?: unknown) => val is T;
// TODO: confirm if [T] extends [infer V] is needed (distributed types?)

export const isSchema = <BinaryIs<Schema>> (
  isValid.bind(null, stdlib, stdlib.Schema.type)
);
export const isRegistry = <BinaryIs<Registry>> (
  isValid.bind(null, stdlib, stdlib.Registry.type)
);
export const isBehavior = <BinaryIs<Behavior>> (
  isValid.bind(null, stdlib, stdlib.Behavior.type)
);

export const isPattern = <BinaryIs<Pattern>> (
  isValid.bind(null, stdlib, stdlib.Pattern.type)
);
export const isField = <BinaryIs<Field>> (
  isValid.bind(null, stdlib, stdlib.Field.type)
);
export const isDeclaration = <BinaryIs<Declaration>> (
  isValid.bind(null, stdlib, stdlib.Declaration.type)
);

const specGenF = <
  Y,
  A extends Array<any>,
  F extends (...args: A) => Generator<unknown, unknown, Y & unknown>,
>(y: Y, fn: F) => fn;

specGenF(<string> Object(), function* ok(request: {}, inputs: []) {
  yield 0;

  yield 1;

  return true;
});
