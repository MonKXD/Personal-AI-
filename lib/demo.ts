/**
 * The public read-only demo account. Anyone can drop into it from the sign-in
 * page ("Take a look inside") — they see a pre-seeded memory and can ask it
 * questions, but every mutation is blocked (see assertCanMutate / requireApiUser
 * `{ write: true }`). Seeded by `npm run seed:demo`.
 */

/** The demo user's auth id. Empty when unset — then nothing is treated as demo. */
export const DEMO_USER_ID = (process.env.DEMO_USER_ID ?? "").trim();

export function isDemoUser(userId: string | null | undefined): boolean {
  return !!DEMO_USER_ID && userId === DEMO_USER_ID;
}

export const DEMO_READONLY_MESSAGE =
  "This is the read-only demo — sign up for a free account to capture your own things.";
