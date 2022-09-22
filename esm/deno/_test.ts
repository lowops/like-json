import stdlib from "github.com/lowops/like-json/esm/like.json" assert {
  type: "json",
};
import {
  isField,
  isRegistry,
  isSchema,
  isValid,
  likeValid,
} from "github.com/lowops/like-json/esm/validation.js";

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

deno.test("like-json validation: reject circular references", async () => {
  const registry = likeValid(stdlib, "Registry", {
    "Recursive": {
      "id": 0,
      "type": {
        "_": "Array containing nulls or other arrays of the same.",
        "array": {
          "items": {
            "type": {
              "_": "Maybe loop.",
              "null": {},
              "like": {
                "valid": { "Recursive": {} },
              },
            },
          },
        },
      },
    },
  });

  const value = new Array();
  value.push([[[null]]]);

  if (!isValid(registry, "Recursive", value)) {
    throw new Error("Non-circular failed schema validation.");
  }

  try {
    value.push(value);

    isValid(registry, "Recursive", value);
    throw Symbol.for("unexpected");
  } catch (err) {
    if (err === Symbol.for("unexpected")) {
      throw new Error("isValid() should reject graphs with circular refs.");
    } else {
      // console.log("[Matched Expectations]", err && err.message || err);
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
