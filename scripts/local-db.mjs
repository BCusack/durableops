#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const command = process.argv[2] ?? "up";
const rootDir = process.cwd();
const homeDir = process.env.HOME || os.homedir();
const dockerConfigDir = path.join(rootDir, ".docker-config");
const defaultDockerConfigDir = path.join(homeDir, ".docker");
const composeFile = path.join(rootDir, "infra", "postgres", "docker-compose.yml");
const postgresUser = process.env.POSTGRES_USER ?? "durableops";
const postgresDb = process.env.POSTGRES_DB ?? "durableops";
const defaultUrl = `postgresql://${postgresUser}:${process.env.POSTGRES_PASSWORD ?? "durableops"}@localhost:5432/${postgresDb}`;
const workflowUrl = process.env.WORKFLOW_POSTGRES_URL ?? defaultUrl;
const dockerEnv = { ...process.env, DOCKER_CONFIG: defaultDockerConfigDir, HOME: homeDir };

await mkdir(defaultDockerConfigDir, { recursive: true });
await writeFile(path.join(defaultDockerConfigDir, "config.json"), JSON.stringify({ auths: {} }, null, 2), "utf8");
await mkdir(dockerConfigDir, { recursive: true });
await writeFile(path.join(dockerConfigDir, "config.json"), JSON.stringify({ auths: {} }, null, 2), "utf8");

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    stdio: options.stdio ?? "inherit",
    env: { ...dockerEnv, ...(options.env ?? {}) },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

async function waitForPostgres() {
  const startedAt = Date.now();
  const timeoutMs = 60_000;

  while (Date.now() - startedAt < timeoutMs) {
    const result = spawnSync(
      "docker",
      ["compose", "-f", composeFile, "exec", "-T", "postgres", "pg_isready", "-U", postgresUser, "-d", postgresDb],
      { stdio: "pipe", env: dockerEnv }
    );

    if (result.status === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.error("PostgreSQL did not become healthy in time.");
  process.exit(1);
}

async function ensureDockerAvailable() {
  const result = spawnSync("docker", ["--version"], { stdio: "pipe", env: dockerEnv });

  if (result.error || result.status !== 0) {
    console.error("Docker is required to start the local DurableOps database.");
    console.error("Install Docker Desktop or Docker Engine and ensure `docker` is on your PATH.");
    process.exit(1);
  }
}

async function startPostgres() {
  await ensureDockerAvailable();
  run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
  await waitForPostgres();
  console.log("Local Postgres is ready.");
}

async function bootstrapWorkflowDatabase() {
  const env = {
    WORKFLOW_TARGET_WORLD: process.env.WORKFLOW_TARGET_WORLD ?? "@workflow/world-postgres",
    WORKFLOW_POSTGRES_URL: workflowUrl,
    POSTGRES_DB: postgresDb,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? "durableops",
  };

  run(
    "npx",
    ["--yes", "--package=@workflow/world-postgres@5.0.0-beta.38", "bootstrap"],
    { env }
  );
  console.log(`Workflow database bootstrapped with ${workflowUrl}`);
}

async function main() {
  try {
    if (command === "up") {
      await startPostgres();
      return;
    }

    if (command === "bootstrap") {
      await ensureDockerAvailable();
      await waitForPostgres();
      await bootstrapWorkflowDatabase();
      return;
    }

    if (command === "up-and-bootstrap") {
      await startPostgres();
      await bootstrapWorkflowDatabase();
      return;
    }

    console.error(`Unknown command: ${command}. Expected one of: up, bootstrap, up-and-bootstrap.`);
    process.exit(1);
  } catch (error) {
    console.error("Local database setup failed.", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();
