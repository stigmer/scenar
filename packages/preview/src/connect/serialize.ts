/**
 * Shared serialization helper for Connect-RPC MSW handlers.
 *
 * When the handler returns a protobuf message (detected via `$typeName`)
 * and the method descriptor carries the output schema, this function
 * uses `@bufbuild/protobuf`'s `toJson()` for canonical JSON encoding
 * (Timestamp → RFC 3339, int64 → string, etc.).
 *
 * For plain objects or when the schema is unavailable, it falls back to
 * a BigInt-safe `JSON.stringify` (protobuf int64 ↔ JSON string).
 */

/**
 * Serialize `result` to a JSON string suitable for a Connect-RPC response.
 *
 * @param result  - The value returned by the fixture handler.
 * @param schema  - The method's output `DescMessage`, if available.
 */
export async function serializeResult(
  result: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any | undefined,
): Promise<string> {
  if (schema && isProtobufMessage(result)) {
    try {
      const { toJson } = await import("@bufbuild/protobuf");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return JSON.stringify(toJson(schema as any, result as any));
    } catch {
      // @bufbuild/protobuf not available — fall through to generic path
    }
  }

  return JSON.stringify(result, (_key, value) =>
    typeof value === "bigint" ? String(value) : (value as unknown),
  );
}

function isProtobufMessage(value: unknown): value is { $typeName: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "$typeName" in value &&
    typeof (value as Record<string, unknown>).$typeName === "string"
  );
}
