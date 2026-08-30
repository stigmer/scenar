import { createInterface } from "node:readline";

/**
 * Ask a yes/no question on stderr and read the answer from stdin.
 * Resolves true only on an explicit yes (`y`/`yes`, case-insensitive) —
 * the safe default for anything that spends money or overwrites work.
 *
 * Callers own the non-interactive policy: when stdin is not a TTY,
 * decide (and message) before calling this — a prompt nobody can
 * answer just hangs a pipeline.
 */
export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${question} [y/N] `, resolve);
    });
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}
