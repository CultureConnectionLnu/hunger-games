/** @type {import("eslint").Linter.Config} */
const config = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
  ],
  rules: {
    // These opinionated rules are enabled in stylistic-type-checked above.
    // Feel free to reconfigure them to your own preference.
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/consistent-type-definitions": "off",

    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      },
    ],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        checksVoidReturn: { attributes: false },
      },
    ],
    "no-restricted-imports": ["error", {
      "paths": [{
        "name": "events",
        "importNames": ["EventEmitter"],
        "message": "Please do not import EventEmitter directly from 'events'. Consider using a different event mechanism or a utility module."
      }, {
        "name": "node:events",
        "importNames": ["EventEmitter"],
        "message": "Please do not import EventEmitter directly from 'node:events'. Consider using a different event mechanism or a utility module."
      }]
    }]
  },
};

module.exports = config;
