import {createDefaultPreset} from "ts-jest";

const defaultPreset = createDefaultPreset({tsconfig: "./tests/tsconfig.json"});

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...defaultPreset,
  testEnvironment: "./tests/_testenv.js",
  globalSetup: "./tests/_globalSetup.ts",
  globalTeardown: "./tests/_globalTeardown.ts",
  testTimeout: 80000,
};
