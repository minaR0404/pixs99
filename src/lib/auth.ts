import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "crypto";

const sql = neon(process.env.DATABASE_URL!);

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  return "ps99_" + randomBytes(24).toString("hex");
}

export async function createApiKey(name: string, githubId?: string): Promise<string> {
  const key = generateApiKey();
  const id = randomBytes(8).toString("hex");
  const prefix = key.slice(0, 12) + "...";
  await sql`
    INSERT INTO api_keys (id, name, key_hash, key_prefix, github_id)
    VALUES (${id}, ${name}, ${hashKey(key)}, ${prefix}, ${githubId ?? null})
  `;
  return key;
}

export async function validateApiKey(key: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM api_keys WHERE key_hash = ${hashKey(key)} AND is_active = TRUE
  `;
  return rows.length > 0;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  is_active: boolean;
  created_at: string;
}

export async function listApiKeys(githubId: string): Promise<ApiKeyInfo[]> {
  const rows = await sql`
    SELECT id, name, key_prefix, is_active, created_at
    FROM api_keys
    WHERE github_id = ${githubId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    prefix: r.key_prefix as string,
    is_active: r.is_active as boolean,
    created_at: r.created_at as string,
  }));
}

export async function revokeApiKey(id: string, githubId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE api_keys SET is_active = FALSE
    WHERE id = ${id} AND github_id = ${githubId}
    RETURNING id
  `;
  return rows.length > 0;
}
