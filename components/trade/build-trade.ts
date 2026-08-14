import type { P2POrder } from "@/components/p2p/types";
import { tradeReference, type Trade } from "./types";

/**
 * Turns an order plus the amount entered in the book into a trade.
 *
 * Shared by the trade screen and the open-orders list so the two can never
 * disagree about what a trade is worth. The entered amount is denominated by
 * side — fiat when buying, USDC when selling.
 */
export function buildTrade(
  order: P2POrder,
  enteredAmount: number,
  method?: string,
): Trade {
  const isBuy = order.mode === "buy";
  const entered = enteredAmount || order.limits.min;

  return {
    orderId: order.id,
    reference: tradeReference(order.id),
    mode: order.mode,
    fiatAmount: isBuy ? entered : entered * order.price,
    assetAmount: isBuy ? entered / order.price : entered,
    price: order.price,
    paymentMethod:
      method && order.paymentMethods.includes(method)
        ? method
        : order.paymentMethods[0],
    windowMinutes: order.windowMinutes,
    counterparty: {
      nickname: order.trader.nickname,
      address: order.trader.address,
      verified: order.trader.verified,
      opsCount: order.trader.opsCount,
    },
  };
}
