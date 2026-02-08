/**
 * Root entry point for Render etc. Runs the backend server (backend/server.js).
 * The backend must be run with cwd = backend so that .env and paths resolve correctly.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const backendDir = path.join(__dirname, "backend");
const result = spawnSync("node", ["server.js"], {
  cwd: backendDir,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
});

process.exit(result.status !== null ? result.status : 0);
