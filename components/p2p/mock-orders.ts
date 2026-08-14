import type { P2POrder } from "./types";

/**
 * Fixtures. USDC trades within a cent of parity, and buy offers sit above sell
 * offers — that spread is what makes the two tabs read differently, so keep it
 * when editing.
 */
export const MOCK_ORDERS: P2POrder[] = [
  {
    id: "ord-cryptotico",
    mode: "buy",
    trader: {
      nickname: "CryptoTico",
      address: "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ",
      verified: true,
      rating: 4.95,
      opsCount: 612,
      completionRate: 99.8,
    },
    price: 1.002,
    available: 8420.5,
    limits: { min: 50, max: 3000 },
    windowMinutes: 15,
    paymentMethods: ["Zelle", "BAC Credomatic"],
    terms:
      "Payment must come from an account in your own name — third-party transfers are rejected. Send the exact amount and include the reference shown in chat.",
  },
  {
    id: "ord-anaswaps",
    mode: "buy",
    trader: {
      nickname: "AnaSwaps",
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      verified: true,
      rating: 4.88,
      opsCount: 198,
      completionRate: 99.1,
    },
    price: 1.004,
    available: 3150.0,
    limits: { min: 20, max: 1200 },
    windowMinutes: 15,
    paymentMethods: ["Zelle"],
    terms:
      "Zelle only, same-name accounts. Please mark the payment as a personal transfer, not a purchase.",
  },
  {
    id: "ord-puravidap2p",
    mode: "buy",
    trader: {
      nickname: "PuraVidaP2P",
      address: "GCK3D3V2XFZ5NQKLPQ7YHRJT4WMSAF6BOZUE2TXNIVQDLW5PHRAE7JXR",
      verified: true,
      rating: 4.92,
      opsCount: 1043,
      completionRate: 98.6,
    },
    price: 1.006,
    available: 21980.75,
    limits: { min: 100, max: 5000 },
    windowMinutes: 30,
    paymentMethods: ["Banco Nacional", "BAC Credomatic", "Wise"],
    terms:
      "Bank transfers processed on business days, 8am–6pm. For orders above $1,000 I may ask for a quick ID check before releasing.",
  },
  {
    id: "ord-chepetrader",
    mode: "buy",
    trader: {
      nickname: "ChepeTrader",
      address: "GBVVJJFLRPJMXOEKXPJDGA7CXHEFCRYMXZFYWJFX7EGBF6ENCF3KSPA",
      verified: false,
      rating: 4.61,
      opsCount: 41,
      completionRate: 95.2,
    },
    price: 1.008,
    available: 180.0,
    limits: { min: 10, max: 400 },
    windowMinutes: 10,
    paymentMethods: ["Zelle"],
    terms:
      "Small orders welcome. Confirm in chat before sending so I can check my remaining balance.",
  },
  {
    id: "ord-ticocambios",
    mode: "buy",
    trader: {
      nickname: "TicoCambios",
      address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFDCE3PWJHKMXAF4PZS",
      verified: true,
      rating: 4.79,
      opsCount: 327,
      completionRate: 97.4,
    },
    price: 1.012,
    available: 12500.0,
    limits: { min: 200, max: 4000 },
    windowMinutes: 20,
    paymentMethods: ["Scotiabank", "Banco Nacional"],
    terms:
      "Transfers accepted from Costa Rican banks only. Include your order reference in the transfer detail.",
  },
  {
    id: "ord-monteverdex",
    mode: "sell",
    trader: {
      nickname: "MonteVerdeX",
      address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      verified: true,
      rating: 4.97,
      opsCount: 874,
      completionRate: 99.6,
    },
    price: 0.998,
    available: 15300.0,
    limits: { min: 50, max: 5000 },
    windowMinutes: 15,
    paymentMethods: ["Zelle", "Banco Nacional"],
    terms:
      "I release within minutes during business hours. Send from an account in your own name.",
  },
  {
    id: "ord-swiftusd",
    mode: "sell",
    trader: {
      nickname: "SwiftUSD",
      address: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      verified: true,
      rating: 4.83,
      opsCount: 256,
      completionRate: 98.9,
    },
    price: 0.996,
    available: 4720.25,
    limits: { min: 40, max: 1800 },
    windowMinutes: 20,
    paymentMethods: ["BAC Credomatic"],
    terms:
      "BAC transfers only. Please do not mention crypto in the transfer note.",
  },
  {
    id: "ord-natiusdc",
    mode: "sell",
    trader: {
      nickname: "NatiUSDC",
      address: "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB",
      verified: true,
      rating: 4.9,
      opsCount: 512,
      completionRate: 99.3,
    },
    price: 0.994,
    available: 9840.0,
    limits: { min: 30, max: 2400 },
    windowMinutes: 15,
    paymentMethods: ["Wise", "Scotiabank"],
    terms:
      "Wise or Scotiabank. The payment must match the exact amount — partial payments are returned.",
  },
  {
    id: "ord-dollarking",
    mode: "sell",
    trader: {
      nickname: "DollarKing",
      address: "GAXLQ7CMJWMSAF3ZHNBRXAVIRZA4KVWLTJJFDCE3PWJHKMXAF4PZQYNF",
      verified: false,
      rating: 4.55,
      opsCount: 63,
      completionRate: 94.7,
    },
    price: 0.991,
    available: 1180.5,
    limits: { min: 10, max: 500 },
    windowMinutes: 10,
    paymentMethods: ["Zelle"],
    terms:
      "Zelle only. Message me in chat before opening the order so I can confirm I am online.",
  },
  {
    id: "ord-caribeexchange",
    mode: "sell",
    trader: {
      nickname: "CaribeExchange",
      address: "GDNTUEQBLRJMXOEKXPJDGA7CXHEFCRYMXZFYWJFX7EGBF6ENCF3KVVJJ",
      verified: true,
      rating: 4.86,
      opsCount: 405,
      completionRate: 98.2,
    },
    price: 0.988,
    available: 33200.0,
    limits: { min: 200, max: 10000 },
    windowMinutes: 30,
    paymentMethods: ["Banco Nacional", "Wise", "BAC Credomatic"],
    terms:
      "High volume welcome. For orders above $5,000 message me first to confirm availability.",
  },
];

/** Every method present in the fixtures, for the filter. */
export const PAYMENT_METHODS = Array.from(
  new Set(MOCK_ORDERS.flatMap((order) => order.paymentMethods)),
).sort();
