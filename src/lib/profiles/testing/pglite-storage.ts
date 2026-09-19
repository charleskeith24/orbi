/**
 * Test-only: the slice of supabase-js Storage that `features/profile/api/supabase-api.ts` uses (`upload`, `remove`,
 * `list`, `createSignedUrls`), executed against the stubbed `storage.objects` table in PGlite as the signed-in user —
 * so the avatars bucket's row-level security policies decide, as they do behind the real Storage API. Like the
 * Storage API it also applies the bucket's size and mime-type limits. File bytes aren't kept, and signed URLs are
 * fake (`https://storage.test/...`): what's proven is WHO may write, list, read and delete WHICH paths.
 */
import type { PGlite } from "@electric-sql/pglite"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createPgliteSupabase } from "@/lib/circles/testing/pglite-client"

type StorageError = { message: string; statusCode: string }
type Result<T> = { data: T; error: null } | { data: null; error: StorageError }

export function createPgliteSupabaseWithStorage(db: PGlite, userId: string | null): SupabaseClient {
  const client = createPgliteSupabase(db, userId) as unknown as Record<string, unknown>

  async function asUser<T>(fn: (q: Pick<PGlite, "query">) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      const claims = JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "authenticated" })
      await tx.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [claims])
      return fn(tx)
    })
  }

  const fail = <T>(message: string, statusCode: string): Result<T> => ({ data: null, error: { message, statusCode } })

  function bucket(id: string) {
    return {
      async upload(path: string, body: Blob, options: { contentType?: string; upsert?: boolean } = {}): Promise<Result<{ path: string }>> {
        const [limits] = (await db.query<{ file_size_limit: number | null; allowed_mime_types: string[] | null }>(
          "select file_size_limit, allowed_mime_types from storage.buckets where id = $1",
          [id]
        )).rows
        if (!limits) return fail("Bucket not found", "404")
        const type = options.contentType ?? body.type
        if (limits.allowed_mime_types && !limits.allowed_mime_types.includes(type)) return fail(`mime type ${type} is not supported`, "415")
        if (limits.file_size_limit !== null && body.size > Number(limits.file_size_limit)) return fail("The object exceeded the maximum allowed size", "413")
        try {
          await asUser((q) =>
            q.query("insert into storage.objects (bucket_id, name, owner_id, metadata) values ($1, $2, $3, $4::jsonb)", [
              id,
              path,
              userId,
              JSON.stringify({ size: body.size, mimetype: type }),
            ])
          )
          return { data: { path }, error: null }
        } catch (error) {
          const message = (error as Error).message
          return fail(/row-level security/.test(message) ? "new row violates row-level security policy" : message, /duplicate/.test(message) ? "409" : "403")
        }
      },

      async remove(paths: string[]): Promise<Result<{ name: string }[]>> {
        const rows = await asUser((q) =>
          q.query<{ name: string }>("delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name", [id, paths])
        )
        return { data: rows.rows, error: null }
      },

      async list(prefix: string, options: { limit?: number } = {}): Promise<Result<{ name: string }[]>> {
        const rows = await asUser((q) =>
          q.query<{ name: string }>(
            "select substr(name, char_length($2) + 2) as name from storage.objects where bucket_id = $1 and name like $2 || '/%' order by name limit $3",
            [id, prefix, options.limit ?? 100]
          )
        )
        return { data: rows.rows, error: null }
      },

      async createSignedUrls(paths: string[], expiresIn: number): Promise<Result<{ path: string; signedUrl: string | null; error: string | null }[]>> {
        const visible = await asUser((q) =>
          q.query<{ name: string }>("select name from storage.objects where bucket_id = $1 and name = any($2::text[])", [id, paths])
        )
        const found = new Set(visible.rows.map((r) => r.name))
        return {
          data: paths.map((path) =>
            found.has(path)
              ? { path, signedUrl: `https://storage.test/object/sign/${id}/${path}?expires=${expiresIn}`, error: null }
              : { path, signedUrl: null, error: "Either the object does not exist or you do not have access to it" }
          ),
          error: null,
        }
      },
    }
  }

  client.storage = { from: bucket }
  return client as unknown as SupabaseClient
}
