declare global {
  interface ObjectConstructor {
    keys<O extends object & {}>(o: O): Array<string & keyof O>;
  }
}

export const toBuiltinString = function () {}.call.bind(
  Object.prototype.toString,
) as (
  (v: unknown) => string
);

export const isBuiltin = function (
  this: (value: unknown) => string,
  label = "[object \b]",
  value: unknown = undefined,
) {
  return !!value && typeof value === "object" && this(value) === label;
}.bind(toBuiltinString);

export const isDataView = <(val: unknown) => val is DataView> (
  isBuiltin.bind(null, toBuiltinString(new DataView(new ArrayBuffer(0)))) // "[object DataView]"
);

export const isMap = <(val: unknown) => val is Map<unknown, unknown>> (
  isBuiltin.bind(null, toBuiltinString(new Map())) // "[object Map]"
);

export const isSet = <(val: unknown) => val is Set<unknown>> (
  isBuiltin.bind(null, toBuiltinString(new Set())) // "[object Set]"
);

export const canonicalizer = function (key = "", val = Object()) {
  switch (typeof val) {
    default: {
      return val;
    }

    case "function": {
      const isAsyncGeneratorFunction = (
        isBuiltin.bind(null, toBuiltinString(async function* () {}))
      ) as (val: unknown) => val is AsyncGeneratorFunction;

      if (!isAsyncGeneratorFunction(val)) return val;
      return val;
    }

    case "object": {
      if (!val || Array.isArray(val)) return val;

      const builtin = toBuiltinString(val);

      switch (builtin) {
        default: {
          const fields = Object.keys(val);

          if (fields.length < 1) return val;
          if (fields.length === 1 && fields[0].length > 1) {
            if (fields[0].charCodeAt(0) === 0x3c) { // "<".charCodeAt(0)
              if (fields[0].charCodeAt(fields[0].length - 1) === 0x3e) { // ">".charCodeAt(0)
                throw new Error("Unsafe Like-JSON key: " + fields[0] + ".");
              }
            }
          }

          const result = Object({});

          fields.sort();

          for (let index = 0; index < fields.length; index += 1) {
            result[fields[index]] = val[fields[index]];
          }

          return result;
        }

        case "[object Map]": {
          if (!isMap(val)) {
            throw new Error("Unresolved Like-JSON built-in: " + builtin);
          }

          return { "<Map>": [...val.entries()] };
        }

        case "[object Set]": {
          if (!isSet(val)) {
            throw new Error("Unresolved Like-JSON built-in: " + builtin);
          }

          return { "<Set>": [...val.values()] };
        }

        case "[object DataView]": {
          if (!isDataView(val)) {
            throw new Error("Unresolved Like-JSON built-in: " + builtin);
          }

          const amount = val.byteLength;
          const size = amount ? (0 | ((amount - 1) / 3)) * 4 + 4 : 0;
          const chars = new Array(size);

          for (let batch = 0; 3 * batch < amount; batch += 1) {
            let uint27 = 0;

            uint27 |= amount > 0 + 3 * batch
              ? val.getUint8(0 + 3 * batch) << (3 + 0 * 8)
              : 1 << 0;

            uint27 |= amount > 1 + 3 * batch
              ? val.getUint8(1 + 3 * batch) << (3 + 1 * 8)
              : 1 << 1;

            uint27 |= amount > 2 + 3 * batch
              ? val.getUint8(2 + 3 * batch) << (3 + 2 * 8)
              : 1 << 2;

            chars[0 + 4 * batch] = B64[63 & (uint27 >> (3 + (0 * 6)))];
            chars[1 + 4 * batch] = B64[63 & (uint27 >> (3 + (1 * 6)))];
            chars[2 + 4 * batch] = uint27 & (1 << 1)
              ? B64[64]
              : B64[63 & (uint27 >> (3 + (2 * 6)))];
            chars[3 + 4 * batch] = uint27 & (1 << 2)
              ? B64[64]
              : B64[63 & (uint27 >> (3 + (3 * 6)))];
          }

          while (chars.length && !chars[chars.length - 1]) chars.pop();

          return { "<DataView>": chars.join("") };
        }

        case "[object Date]": {
          return { "<Date>": val.toISOString() };
        }
      }
    }

    case "bigint": {
      return { "<bigint>": val.toString(10) };
    }
  }
};

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const _64 = B64.replace("+/", "-_");

const A128 = new Array(128).fill(0 / 0).map((_, code) => {
  if (code === 0x3d) return -0; // "=".charCodeAt(0)
  else if (code === 0x2b) return 62; // "+".charCodeAt(0)
  else if (code === 0x2f) return 63; // "/".charCodeAt(0)
  else if (code < 0x30) return 0 / 0; // "0".charCodeAt(0)
  else if (code <= 0x39) return code - 0x30 + 0 + 10; // "9".charCodeAt(0)
  else if (code < 0x41) return 0 / 0; // "A".charCodeAt(0)
  else if (code <= 0x5a) return code - 0x41 + 0; // "Z".charCodeAt(0)
  else if (code < 0x61) return 0 / 0; // "a".charCodeAt(0)
  else if (code <= 0x7a) return code - 0x61 + 0 + 10 + 26; // "z".charCodeAt(0)
  else return 0 / 0;
});
const _128 = A128.map((bits, code) => {
  switch (code) {
    case 0x2b: // "+".charCodeAt(0)
    case 0x2f: // "/".charCodeAt(0)
      return 0 / 0;
    case 0x2d: // "-".charCodeAt(0)
      return 62;
    case 0x5f: // "_".charCodeAt(0)
      return 63;
    default:
      return bits;
  }
});

export const unmarshaller = function () {
  const val = arguments[1];

  if (!val || typeof val !== "object" || Array.isArray(val)) return val;

  const names = Object.keys(val);

  if (names.length !== 1) return val;

  const field = names[0];

  if (field.charCodeAt(0) !== 0x3c) return val; // "<".charCodeAt(0)
  if (field.charCodeAt(field.length - 1) !== 0x3e) return val; // ">".charCodeAt(0)

  switch (field.slice(0, field.indexOf("<", 1))) {
    default: {
      return val;
    }

    case "<Map": {
      try {
        return new Map(val[field]);
      } catch (err) {
        break;
      }
    }

    case "<Set": {
      try {
        return new Set(val[field]);
      } catch (err) {
        break;
      }
    }

    case "<Date": {
      if (typeof val[field] !== "string") break;
      const text = val[field];
      const date = new Date(text);

      if (date.toISOString() !== text) {
        throw new Error("Malformed Like-JSON Date.");
      }

      return date;
    }

    case "<bigint": {
      if (typeof val[field] !== "string") break;
      const text = val[field];

      if (text !== "0" && !/^-?[1-9][0-9]*$/.test(text)) {
        throw new Error("Malformed Like-JSON bigint.");
      }

      return BigInt(text);
    }

    case "<DataView": {
      if (typeof val[field] !== "string") break;

      const text = val[field];
      const amount = text.length;
      const padding = 0 | +(amount > 1 && text.charCodeAt(amount - 2) === 0x3d); // "=".charCodeAt(0)
      const margin = 0 | +(amount > 0 && text.charCodeAt(amount - 1) === 0x3d); // "=".charCodeAt(0)
      const size = 3 * (amount / 4) - margin - padding;
      const data = new DataView(new ArrayBuffer(size));

      if (3 & amount) throw new Error("Invalid Like-JSON DataView.");

      for (let batch = 0; 4 * batch < amount; batch += 1) {
        let uint24 = 0;

        uint24 += A128[text.charCodeAt(0 + 4 * batch)] << (0 * 6);
        uint24 += A128[text.charCodeAt(1 + 4 * batch)] << (1 * 6);
        uint24 += A128[text.charCodeAt(2 + 4 * batch)] << (2 * 6);
        uint24 += A128[text.charCodeAt(3 + 4 * batch)] << (3 * 6);

        if (uint24 !== uint24) {
          throw new Error("Malformed Like-JSON DataView.");
        }
        data.setUint8(0 + 3 * batch, 255 & (uint24 >> (0 * 8)));

        if (amount <= 1 + 3 * batch) break;
        data.setUint8(1 + 3 * batch, 255 & (uint24 >> (1 * 8)));

        if (amount <= 2 + 3 * batch) break;
        data.setUint8(2 + 3 * batch, 255 & (uint24 >> (2 * 8)));
      }

      return data;
    }
  }
};

export const parse = (text: string) => JSON.parse(text, unmarshaller);
export const stringify = (val: unknown) => JSON.stringify(val, canonicalizer);

export type JSONLike =
  | null
  | boolean
  | string
  | number
  | bigint // | { "<bigint>": string }
  | Date // | { "<Date>": string }
  | Set<unknown> // | { "<Set>": Array<unknown> }
  | Map<unknown, unknown> // | { "<Map>": Array<unknown> }
  | DataView // | { "<DataView>": string | Array<number> }
  | Array<JSONLike>
  | { [key: string]: JSONLike };
