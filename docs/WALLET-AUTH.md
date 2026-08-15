# Wallet connection and authentication

How SafeSwap connects to Freighter, and how the server learns which wallet it
is actually talking to.

Companion to [`SUPABASE-SCHEMA.md`](./SUPABASE-SCHEMA.md) — the database is
keyed by wallet address, which is precisely why the second half of this
document exists.

Researched 2026-08-15 against `@stellar/freighter-api@6.0.1` (latest) and
`@stellar/stellar-sdk@16.x`.

**Status:** step 1 of §6 is built — `components/wallet/wallet-provider.tsx`
handles connection, silent restore, network guarding and signing, and the app
targets **testnet** (`EXPECTED_NETWORK` in `lib/wallet.ts`). Steps 2–3, the
challenge/verify routes that make an address *trustworthy*, are not.

Until then the app knows which wallet is connected but the server cannot
prove it — so no server write may derive its actor from the client yet.

---

## 1. The distinction that shapes everything

**Connecting is not authenticating.**

`requestAccess()` returns an address that *the browser extension claims*.
Nothing in that exchange proves the user controls the corresponding secret
key. Any page can POST any address to our API.

That was harmless while the address only drove the UI. It stopped being
harmless the moment the database became keyed by wallet address and the server
started writing rows on behalf of one. An unauthenticated address means anyone
can post ads, open trades, or send chat messages as anyone else.

So there are two separate flows, and both are needed:

| | Purpose | Proves |
|---|---|---|
| **Connect** | Get the address, show a UI | nothing |
| **Authenticate** | Sign a server challenge | control of the secret key |

---

## 2. Freighter API surface (v6)

`@stellar/freighter-api@6.0.1`. **Every function returns
`{ ...result, error? }` and never throws** — check `error` on every call.

| Call | Prompts? | Returns |
|---|---|---|
| `isConnected()` | no | `{ isConnected }` — is the extension installed |
| `isAllowed()` | no | `{ isAllowed }` — is this origin on the allow list |
| `setAllowed()` | yes | `{ isAllowed }` |
| `requestAccess()` | **yes** | `{ address }` |
| `getAddress()` | **no** | `{ address }` — empty string if not authorized |
| `getNetwork()` | no | `{ network, networkPassphrase }` |
| `getNetworkDetails()` | no | adds `networkUrl`, `sorobanRpcUrl` |
| `signTransaction(xdr, opts)` | yes | `{ signedTxXdr, signerAddress }` |
| `signMessage(msg, opts)` | yes | `{ signedMessage, signerAddress }` |
| `signAuthEntry(xdr, opts)` | yes | `{ signedAuthEntry, signerAddress }` |
| `WatchWalletChanges` | — | polling class for account/network switches |

**`requestAccess()` vs `getAddress()` is the important pair.** `getAddress()`
does not prompt and returns an empty string when the origin is not authorized,
which makes it the right call for silently restoring a session on page load.
`requestAccess()` is the connect button.

---

## 3. Authentication: SEP-53

[SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md)
is the Stellar standard for signing arbitrary messages. It reached **Final
status on 2026-06-18**. Freighter's `signMessage` implements it.

The scheme:

```
payload   = "Stellar Signed Message:\n" + message
signature = ed25519_sign(secretKey, SHA256(payload))
```

The fixed prefix is the security property: it guarantees a signed message can
never be replayed as a signed transaction, the same trick Bitcoin and Ethereum
use.

**Do not implement that by hand.** `stellar-sdk` ships both sides:

```ts
import { Keypair } from "@stellar/stellar-sdk";

const ok = Keypair.fromPublicKey(address)
  .verifyMessage(challenge, Buffer.from(signature, "base64"));
```

`Keypair.signMessage` / `Keypair.verifyMessage` are documented in the SDK as
SEP-53 implementations, prefix and SHA-256 included.

### Why not SEP-10

SEP-10 is the other candidate and the one Stellar's docs cover at length, but
those docs scope it to **wallet ↔ anchor** authentication. It needs a server
keypair, a home domain, a `web_auth_domain`, and a full challenge
*transaction*. `stellar-sdk` supports it (`WebAuth.buildChallengeTx`,
`readChallengeTx`, `verifyChallengeTxSigners`) if we ever need it.

For logging a user into our own backend, SEP-53 does the same job with far
less machinery. Revisit SEP-10 if SafeSwap ever integrates with anchors.

---

## 4. The flow

```
  browser                          server
  ───────                          ──────
1 isConnected()
    └─ not installed → link to freighter.app

2 requestAccess()  ──prompt──▶ address

3                    GET /api/auth/challenge?address=…
                     ◀── { challenge, expiresAt }
                         server stores nonce, single use

4 signMessage(challenge)  ──prompt──▶ base64 signature

5                    POST /api/auth/verify { address, signature }
                         Keypair.fromPublicKey(address)
                           .verifyMessage(challenge, sig)
                     ◀── Set-Cookie: httpOnly session

6 WatchWalletChanges → account or network switch → drop session, repeat
```

**The challenge must carry a nonce, our domain, and a short expiry.** The
domain stops a phishing origin reusing a signature it collected; the nonce and
expiry stop replay. Burn the nonce on use.

**The session cookie is the identity.** It carries the *verified* address, and
every server write derives the actor from it — never from a request body.
That is the whole point: `traders.address`, `ads.advertiser`, `trades.maker`
and `trades.taker` are only trustworthy if the address came from a verified
session.

---

## 5. Reference implementation, and what not to copy

The previous app has a working connection at
`/Users/danielcdz/Repos/SafeSwap/p2p-safe-swap/frontend/lib/wallet-context.tsx`
— same library version, worth reading. Three things should not carry over:

1. **It hardcodes the testnet passphrase when signing.** If the user's
   Freighter is on mainnet, that signs against the wrong network. Read the
   passphrase from `getNetwork()` instead, and refuse to sign when the wallet's
   network is not the one the app expects.
2. **It never watches for changes.** Switching account or network in the
   extension leaves the app displaying a stale address. Use
   `WatchWalletChanges`.
3. **It treats the returned address as identity.** See §1. Fine for the UI it
   had; not sufficient now.

### Gotchas

- **`signMessage` has two response shapes.** The type is a union:
  `signedMessage` is `string | null` in v4 and `Buffer | null` in v3. Handle
  both, and normalise to a base64 string before sending it to the server.
- **Pass `opts.address` explicitly** to `signMessage` and `signTransaction` so
  the signature comes from the account the app thinks it is talking to, not
  whichever one the extension happens to have selected.
- **`isConnected()` reports the extension, not the account.** Installed but
  locked or unauthorized still returns `true`.
- **Addresses must satisfy `^G[A-Z2-7]{55}$`** before they reach the database
  — 56 characters. Three of our fixtures were 55 and the CHECK rejected them.
  A real address also carries a CRC16 checksum, which only the SDK validates.

---

## 6. Build order

1. ~~**`useWallet()` provider**~~ — **done.** Connect, silent restore via
   `getAddress()`, network read from `getNetwork()`, `WatchWalletChanges`
   wired up. The `CONNECTED_ADDRESS` stub is gone.
2. **Challenge/verify routes** — `GET /api/auth/challenge`,
   `POST /api/auth/verify`, nonce store, httpOnly session cookie.
3. **Server-side actor** — a helper that reads the session and returns the
   verified address, used by every route that writes to Supabase.
4. ~~**Connect screen**~~ — **done.** Real flow with *not installed* (offers
   the download), *rejected*, and *wrong network* states.

Steps 1 and 4 change what the user sees. Steps 2 and 3 are what make the
database trustworthy.

---

## Sources

- [SEP-0053 — Sign and Verify Messages](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md)
- [SEP-53 discussion](https://github.com/orgs/stellar/discussions/1641)
- [Freighter API — signing](https://docs.freighter.app/extension-freighter-api/signing.md)
- [Freighter API — reading data](https://docs.freighter.app/extension-freighter-api/reading-data.md)
- [Stellar docs — SEP-10 authentication](https://developers.stellar.org/docs/build/apps/wallet/sep10)
