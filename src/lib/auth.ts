import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  return "ir_" + randomBytes(24).toString("hex");
}

export async function createApiKey(name: string): Promise<string> {
  const key = generateApiKey();
  const id = randomBytes(8).toString("hex");
  await sql`
    INSERT INTO api_keys (id, name, key_hash)
    VALUES (${id}, ${name}, ${hashKey(key)})
  `;
  return key;
}

export async function validateApiKey(key: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM api_keys WHERE key_hash = ${hashKey(key)} AND is_active = TRUE
  `;
  return rows.length > 0;
}
