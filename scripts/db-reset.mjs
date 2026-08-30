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

/** Receipt images from trade chat, and profile pictures. */
const ATTACHMENTS = "trade-attachments";
const AVATARS = "trader-avatars";

/**
 * Objects in a bucket, as full paths, optionally skipping whole folders.
 *
 * Both buckets store one folder per owner — a trade id for attachments, an
 * address for avatars — which is what makes --keep possible below.
 */
async function objectPaths(bucket, skipFolders = []) {
  const { data: entries, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 1000 });
  if (error) throw new Error(`${bucket}: ${error.message}`);

  const paths = [];
  for (const entry of entries ?? []) {
    // Folders are synthesised from object names and come back with a null id.
    if (entry.id !== null) {
      paths.push(entry.name);
      continue;
    }
    if (skipFolders.includes(entry.name)) continue;

    const { data: objects, error: nested } = await supabase.storage
      .from(bucket)
      .list(entry.name, { limit: 1000 });
    if (nested) throw new Error(`${bucket}: ${nested.message}`);
    for (const object of objects ?? []) paths.push(`${entry.name}/${object.name}`);
  }
  return paths;
}

/** Removes objects a bucket sweep selected, if there are any. */
async function removeObjects(bucket, paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(`${bucket}: ${error.message}`);
}

/** What the report lists — the tables, plus the buckets that shadow them. */
const ROWS = [...TABLES, "attachments", "avatars"];

async function counts() {
  const entries = await Promise.all(
    TABLES.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return [table, error ? "?" : (count ?? 0)];
    }),
  );

  const objects = async (bucket, skip) => {
    try {
      return (await objectPaths(bucket, skip)).length;
    } catch {
      return "?";
    }
  };

  return {
    ...Object.fromEntries(entries),
    attachments: await objects(ATTACHMENTS),
    // Kept traders keep their pictures, the same as they keep their ads.
    avatars: await objects(AVATARS, everything ? keep : undefined),
  };
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
  await removeObjects(ATTACHMENTS, await objectPaths(ATTACHMENTS));

  if (everything) {
    const adsQuery = supabase.from("ads").delete();
    await run(
      "ads",
      keep.length
        ? adsQuery.not("advertiser", "in", `(${keep.join(",")})`)
        : adsQuery.not("id", "is", null),
    );

    // Pictures go with the traders that own them, and only then: a kept
    // trader keeps their face, the same as they keep their ads.
    await removeObjects(AVATARS, await objectPaths(AVATARS, keep));

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
