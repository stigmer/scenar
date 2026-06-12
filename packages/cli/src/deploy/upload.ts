/**
 * Upload one file's bytes to its presigned PUT target.
 *
 * The presign binds the content type and SHA-256 into the signature, so every
 * header the backend returned in `required_headers` is replayed verbatim. The
 * backend intentionally omits host and content-length (the HTTP layer owns
 * them) — fetch sets content-length from the body, matching the declared size.
 */
export async function putFile(
  presignedPutUrl: string,
  requiredHeaders: Record<string, string>,
  bytes: Uint8Array,
): Promise<void> {
  const response = await fetch(presignedPutUrl, {
    method: "PUT",
    headers: requiredHeaders,
    // The DOM BodyInit type is overly narrow for Uint8Array under this TS/lib
    // combination; raw bytes are a valid fetch body at runtime.
    body: bytes as unknown as BodyInit,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `upload failed (${response.status} ${response.statusText})` +
        (detail ? `: ${detail.slice(0, 300)}` : ""),
    );
  }
}
