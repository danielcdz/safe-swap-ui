/**
 * Clears test data from the SafeSwap database.
 *
 *   npm run db:reset                     dry run — counts what would go
 *   npm run db:reset -- --yes            delete trades, chat, and reviews
 *   npm run db:reset -- --all --yes      also delete ads and traders
 *   npm run db:reset -- --all --yes --keep G...,G...
 *
 * Dry run is the default on purpose. Nothing is deleted unless --yes is
 * present, and the project being targeted is printed every time — the point of
 * failure this guards against is running it against the wrong database, which
 * no confirmation prompt catches if you cannot see where you are pointed.
 */
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] ?? null;
};

const commit = has("--yes");
const everything = has("--all");
const keep = (valueOf("--keep") ?? "")
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error(
    "SUPABASE_URL and SUPABASE_SECRET_KEY must be set.\n" +
      "Run it through npm, which loads .env.local: npm run db:reset",
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run with NODE_ENV=production.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Which Supabase project this is about to touch. */
const projectRef = new URL(url).hostname.split(".")[0];

const TABLES = [
  "trade_messages",
  "trade_reviews",
  "trades",
  "ads",
  "trader_verifications",
  "traders",
  "auth_challenges",
];

/** Receipt images from trade chat. */
const BUCKET = "trade-attachments";

/** Everything in the attachments bucket, as full object paths. */
async function attachmentPaths() {
  const { data: entries, error } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (error) throw new Error(`attachments: ${error.message}`);

  const paths = [];
  for (const entry of entries ?? []) {
    // Objects are stored under a folder per trade. Folders are synthesised
    // from the object names and come back with a null id.
    if (entry.id !== null) {
      paths.push(entry.name);
      continue;
    }
    const { data: objects, error: nested } = await supabase.storage
      .from(BUCKET)
      .list(entry.name, { limit: 1000 });
    if (nested) throw new Error(`attachments: ${nested.message}`);
    for (const object of objects ?? []) paths.push(`${entry.name}/${object.name}`);
  }
  return paths;
}

/** What the report lists — the tables, plus the bucket that shadows them. */
const ROWS = [...TABLES, "attachments"];

async function counts() {
  const entries = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return [table, error ? "?" : (count ?? 0)];
    }),
  );

  let attachments;
  try {
    attachments = (await attachmentPaths()).length;
  } catch {
    attachments = "?";
  }

  return { ...Object.fromEntries(entries), attachments };
}

function report(label, before, after) {
  console.log(`\n  ${label}`);
  for (const table of ROWS) {
    const from = before[table];
    const to = after?.[table];
    const line = after === undefined ? `${from}` : `${from} → ${to}`;
    console.log(`    ${table.padEnd(22)} ${line}`);
  }
}

async function run(label, query) {
  const { error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function main() {
  console.log(`\n  project   ${projectRef}`);
  console.log(`  scope     ${everything ? "trades + ads + traders" : "trades only"}`);
  if (keep.length) console.log(`  keeping   ${keep.join(", ")}`);
  console.log(`  mode      ${commit ? "DELETE" : "dry run (add --yes to commit)"}`);

  const before = await counts();

  if (!commit) {
    report("would clear:", before);
    console.log("\n  Nothing was deleted. Add --yes to commit.\n");
    return;
  }

  // Trades first: trades.ad_id and trades.maker/taker are ON DELETE RESTRICT,
  // so ads and traders cannot go while any trade still points at them.
  // trade_messages and trade_reviews cascade from here.
  await run("trades", supabase.from("trades").delete().not("id", "is", null));

  // Those trades were holding inventory. Releasing it is not optional — an ad
  // whose reservation outlives its trade shows less available than it has,
  // forever, with nothing left to explain why.
  await run(
    "reservations",
    supabase.from("ads").update({ reserved_amount: 0 }).gt("reserved_amount", 0),
  );

  // Storage does not cascade from Postgres. Deleting a trade takes its
  // messages with it but leaves the images those messages pointed at, in a
  // private bucket where nothing will ever name them again — the same shape of
  // problem as the reservation above, and just as invisible.
  const paths = await attachmentPaths();
  if (paths.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw new Error(`attachments: ${error.message}`);
  }

  if (everything) {
    const adsQuery = supabase.from("ads").delete();
    await run(
      "ads",
      keep.length
        ? adsQuery.not("advertiser", "in", `(${keep.join(",")})`)
        : adsQuery.not("id", "is", null),
    );

    // trader_verifications cascades from traders.
    const tradersQuery = supabase.from("traders").delete();
    await run(
      "traders",
      keep.length
        ? tradersQuery.not("address", "in", `(${keep.join(",")})`)
        : tradersQuery.not("address", "is", null),
    );
  }

  // One row per sign-in attempt, and nothing ever collects them.
  await run(
    "challenges",
    supabase.from("auth_challenges").delete().not("nonce", "is", null),
  );

  report("cleared:", before, await counts());
  console.log("");
}

main().catch((error) => {
  console.error(`\n  Failed: ${error.message}\n`);
  process.exit(1);
});
