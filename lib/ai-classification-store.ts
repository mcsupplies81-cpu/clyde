import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Classification, ClassifyInput } from "./ai-classifier";

const STORE_PATH = path.join(process.cwd(), "data", "ai_classifications.json");

export async function saveClassification(input: ClassifyInput, classification: Classification): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const existing = await readStore();
  existing.push({ ...input, ...classification, createdAt: new Date().toISOString() });
  await writeFile(STORE_PATH, JSON.stringify(existing, null, 2), "utf8");
}

async function readStore(): Promise<Array<Record<string, unknown>>> {
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8")) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}
