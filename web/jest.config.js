module.exports = {
  preset: "ts-jest",
  testEnvironment: "./tests/_testenv.js",
  globalSetup: "./tests/_globalSetup.ts",
  globalTeardown: "./tests/_globalTeardown.ts",
  testTimeout: 80000,
};
