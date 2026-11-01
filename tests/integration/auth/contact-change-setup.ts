import { setup as prepareSchema } from "../global-setup";

export async function setup() {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (
    target.protocol !== "postgresql:" ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/rsvp_test" ||
    process.env.CONTACT_CHANGE_DISPOSABLE_DB !== "01a18e04"
  ) {
    throw new Error(
      "Contact-change integration requires the explicit disposable 127.0.0.1:55432/rsvp_test target and CONTACT_CHANGE_DISPOSABLE_DB=01a18e04."
    );
  }
  await prepareSchema();
}
