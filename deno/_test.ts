import stdlib from "../ts/src/like.json" assert { type: "json" };
import {
  isField,
  isRegistry,
  isSchema,
  likeValid,
} from "../ts/src/like-valid.ts";

const deno = globalThis["Deno"];

deno.test("like-json validation: isSchema()", async () => {
  if (!isSchema(stdlib.Schema.type)) {
    throw new Error("Schema failed self-validation.");
  }

  const keys = Object.keys(stdlib);
  for (let index = 0; index < keys.length; index += 1) {
    if (!isSchema(stdlib[keys[index]].type)) {
      throw new Error("Rejected registerd Schema: '" + keys[index] + "'.");
    }
  }
});

deno.test("like-json validation: isRegistry()", async () => {
  if (!isRegistry(stdlib)) {
    throw new Error("Registry failed schema validation.");
  }
});

deno.test("like-json validation: false positive", async () => {
  try {
    if (!isField(stdlib.Pattern.type)) {
      throw Symbol.for("expected");
    } else {
      throw Symbol.for("error");
    }
  } catch (err) {
    if (err !== Symbol.for("expected")) {
      throw new Error("isField() may have given a false positive.");
    }
  }
});

// type-check
likeValid(
  [
    {
      "a": { id: 0, type: { "_": "", "array": {} } },
      "_": { id: 1, type: { "_": {}, "0": { "_": [] } } },
    },
    stdlib,
  ],
  "a",
)?.length;
