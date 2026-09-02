import { readFile } from "node:fs/promises";

export async function loadEnvFile(filePath, { override = false } = {}) {
  let contents;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || process.env[match[1]] === undefined) {
      process.env[match[1]] = value;
    }
  }
}

export async function loadProjectEnv(rootDir) {
  await loadEnvFile(`${rootDir}/.env`);
  await loadEnvFile(`${rootDir}/.env.local`, { override: true });
}
