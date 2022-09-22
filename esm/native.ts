declare global {
  interface ObjectConstructor {
    keys<O extends object & {}>(o: O): Array<string & keyof O>;
  }
}

type Mutex<T> = {
  [P in keyof T]: {
    [N in keyof MandatoryUnless<{ [M in keyof T]: M }, Exclude<keyof T, P>>]: (
      N extends P ? T[N] : never
    );
  };
}[keyof T];

type MandatoryUnless<T, E> =
  & { [P in keyof T as T[P] extends E ? never : P]: T[P] }
  & { [P in keyof T as T[P] extends E ? P : never]?: T[P] };

type AttenuatedUnless<T, E> = {
  [P in keyof T as T[P] extends E ? P : never]: T[P];
};

type Squash<U> = Intersect<U> extends infer I ? (
    I extends never ? never
      : I extends object ? { [P in keyof I]: I[P] }
      : I
  )
  : never;

// https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type#answer-50375286
type Intersect<U> = (
  U extends any ? (u: U) => void : never
) extends ((i: infer I) => void) ? I : never;

type List<T = unknown, R extends Array<unknown> = Array<T>> = [T, ...R];

type Idx = number;

type FirstHaving<
  T extends Array<unknown>,
  N extends KeysFrom<T>,
> = T["length"] extends 0 ? never
  : N extends keyof T[0] ? T[0]
  : T extends List<unknown, infer R> ? (
      N extends KeysFrom<R> ? FirstHaving<R, N> : never
    )
  : never;

export type KeysFrom<T> = T extends Array<unknown> ? (
    keyof Intersect<Partial<T[Idx]>>
  )
  : keyof T;

type Tuplized<
  O extends { [index: number]: unknown },
  T extends Array<unknown> = [],
> = `${T["length"]}` extends keyof O ? Tuplized<O, [...T, O[T["length"]]]>
  : T["length"] extends keyof O ? Tuplized<O, [...T, O[T["length"]]]>
  : T;

type NPlusOne<T> = [T, ...Array<T>];

export type Registrations = Registry | Registries;
export type Registries = NPlusOne<Registry>;

export interface Registry {
  [alias: string]: {
    id: number;
    type: Schema;
  };
}

export type Schema = And | Or | Pattern;

export interface And {
  _: Array<never>;
  ""?: never; // metadata/documentation placeholder
  [id: number]: Schema;
}

// TODO: re-evaluate use of object & {} everywhere
export interface Or {
  _: Exclude<object & {}, Array<any>>;
  ""?: never; // metadata/documentation placeholder
  [id: number]: Schema;
}

// TODO: ...consider the pros/cons of making Pattern a Mutex<{}>
export interface Pattern {
  _: string; // can be used for documentation
  ""?: never; // metadata/documentation placeholder
  [id: number]: never;

  "data"?: object & {};
  "null"?: object & {};
  "boolean"?: {
    always?: (
      | { true: object & {}, false?: never }
      | { false: object & {}, true?: never }
    );
  };
  "float"?: {
    depth?: object & {};
    safe?: { integer?: object & {} };
  };
  "int"?: {
    enums?: { [code: number]: object & {} };
    depth?: object & {};
    safe?: object & {};
  };
  "string"?: {
    enums?: { [label: string]: object & {} };
    // TODO: additionally consider something regex-related...
  };
  "object"?: {
    keys?: { numeric?: object & {} };
    fields?: { [name: string]: Field };
    values?: Declaration;
  };
  "array"?: {
    prefix?: { [index: number]: Declaration };
    items?: Declaration;
  };

  "method"?: Behavior;

  "like"?: {
    "valid"?: { [alias: string]: object & {} | undefined }; // undefined helps typescript work with json-modules...
    "schema"?: object & {};
    "registry"?: object & {};
    "behavior"?: object & {};
    "pattern"?: object & {};
    "field"?: object & {};
    "declaration"?: object & {};
  };
}

export interface Behavior {
  ts?: {
    awaits?: object & {};
    yields?: Schema;
    takes?: Array<Schema>;
    returns?: Schema;
  };
}

export interface Declaration {
  type: Schema;
}

export interface Field {
  id: number;
  mutex?: object & {};
  optional?: object & {};
  type: Schema;
}

type BigString<T extends bigint> = `${T}`;
type FloatString<T extends number> = `${T}`;

type ToObject<
  F extends { [name: string]: Field },
  R extends Registrations,
> = {
  [N in keyof MandatoryUnless<F, { optional: {} }>]: Valid<F[N]["type"], R>;
};

type Inferred<
  S extends Schema, // | KeysFrom<R>, // ts(2589) Type instantiation is excessively deep and possibly infinite.
  R extends Registrations,
> = [
  (
    S extends { like: infer L } ? (
        | (
          L extends { valid: infer V } ? (
              {
                [N in keyof V]: (
                  V[N] extends {} ? Valid<Lookup<R, N>, R> : never
                );
              }[keyof V]
            )
            : never
        )
        | (L extends { schema: {} } ? Schema : never)
        | (L extends { registry: {} } ? Registry : never)
        | (L extends { behavior: {} } ? Behavior : never)
        | (L extends { pattern: {} } ? Pattern : never)
        | (L extends { field: {} } ? Field : never)
        | (L extends { declaration: {} } ? Declaration : never)
      )
      : never
  ),

  // TODO: { method: {} }

  (S extends { data: {} } ? DataView : never),
  (S extends { null: {} } ? null : never),
  (S extends { float: {} } ? number : never),
  (
    S extends { int: { depth?: infer D; enums?: infer E } } ? (
        D extends { 32: {} } ? (
            E extends { [code: number]: {} } ? (
                `${(number | string) & keyof E}` extends FloatString<infer F>
                  ? (F)
                  : never
              )
              : number
          )
          : (
            E extends { [code: number]: {}; [text: string]: {} } ? (
                `${(number | string) & keyof E}` extends BigString<infer B>
                  ? (B)
                  : never
              )
              : bigint
          )
      )
      : never
  ),
  (
    S extends { string: { enums?: infer E } }
      ? (E extends { [label: string]: {} } ? keyof E : string)
      : never
  ),
  (
    S extends { boolean: infer B } ? (
        B extends { always: { true: {} } } ? true
          : B extends { always: { false: {} } } ? false
          : B extends { always: any } ? never // no share of this mutex is optional
          : B extends {} ? boolean
          : never
      )
      : never
  ),
  (
    S extends { array: { items?: infer I; fields?: infer F } } ? (
        F extends { [index: string]: Declaration } ? [
            ...Tuplized<
              {
                [X in keyof F]: (
                  X extends number | `${number}` ? Valid<F[X]["type"], R> : F[X]
                );
              }
            >,
            ...(I extends Declaration ? Array<Valid<I["type"], R>> : []),
          ]
          : (
            I extends Declaration ? Array<Valid<I["type"], R>> : Array<never>
          )
      )
      : never
  ),
  (
    S extends { object: { values?: infer V; fields?: infer F } } ? (
        & (
          V extends Declaration ? (
              S extends { object: { keys: { numeric: {} } } }
                ? { [id: number]: Valid<V["type"], R> }
                : { [key: string]: Valid<V["type"], R> }
            )
            : (
              keyof F extends never ? object & {} : unknown
            )
        )
        & (
          F extends { [name: string]: Field } ? (
              // AttenuatedUnless<F, { mutex: {} }> extends infer T ? (
              //     keyof T extends never ? (
              //         ToObject<F, R>
              //       )
              //       : T extends { [name: string]: Field } ? (
              //           & Mutex<ToObject<T, R>>
              //           & ToObject<Omit<F, keyof T>, R>
              //         )
              //       : never
              //   )
              //   : never

              // TODO: figure out how to get good type hints with ToObject/AttenuatedUnless
              {
                [M in keyof F as F[M] extends { mutex: {} } ? M : never]: F[M];
              } extends infer T ? (
                  keyof T extends never ? {
                      [
                        N in keyof MandatoryUnless<
                          F,
                          { optional: {} }
                        >
                      ]: (
                        Valid<F[N]["type"], R>
                      );
                    }
                    : T extends { [name: string]: Field } ? (
                        & Mutex<
                          {
                            [
                              N in keyof MandatoryUnless<
                                T,
                                { optional: {} }
                              >
                            ]: (
                              Valid<T[N]["type"], R>
                            );
                          }
                        >
                        & (
                          Exclude<keyof F, keyof T> extends never ? object
                            : {
                              [
                                N in keyof MandatoryUnless<
                                  Omit<F, keyof T>,
                                  { optional: {} }
                                >
                              ]: (
                                Valid<F[N]["type"], R>
                              );
                            }
                        )
                      )
                    : never
                )
                : never
            )
            : object & {}
        )
      )
      : never
  ),
][Idx];

type Valid<
  S extends Schema, // = R["_"],
  R extends Registrations,
> = S extends Pattern ? Inferred<S, R>
  : S extends And ? (
      number & keyof S extends never ? unknown : (
        Squash<
          { [N in number & keyof S[N]]: Inferred<S[N], R> }[number & keyof S]
        >
      )
    )
  : S extends Or ? (
      {
        [N in number & keyof S]: (
          S[N] extends Pattern ? Inferred<S[N], R> : never
        );
      }[number & keyof S]
    )
  : never;

type Lookup<
  R extends Registrations,
  N, // TODO: maybe try to extends this
> = N extends KeysFrom<R> ? (
    R extends Registries ? FirstHaving<R, N>[N]["type"]
      : R extends Registry ? R[N]["type"]
      : never
  )
  : never;

export type Native<
  R extends Registrations,
  T extends Schema | KeysFrom<R> = "_" extends KeysFrom<R> ? "_" : never,
> = (
  // (infer V) prevents ts(2589) Type instantiation is excessively deep and possibly infinite.
  Valid<T extends Schema ? T : Lookup<R, T>, R> extends (infer V) ? V : never
);
