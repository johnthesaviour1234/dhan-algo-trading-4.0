import type { ProcessedOrder } from '../App';

/**
 * Calculate net position for a security from order list
 * Positive = LONG position
 * Negative = SHORT position
 * Zero = NEUTRAL
 */
export function calculateNetPosition(orders: ProcessedOrder[], securityId: string): {
    netQuantity: number;
    totalBuy: number;
    totalSell: number;
    isLong: boolean;
    isShort: boolean;
    isNeutral: boolean;
} {
    let totalBuy = 0;
    let totalSell = 0;

    orders.forEach(order => {
        // Only count TRADED/PART_TRADED orders for the specific security
        if (
            order.symbol === securityId &&
            (order.status === 'Traded' || order.status === 'PART_TRADED')
        ) {
            const qty = order.traded_qty || 0;

            if (order.txn_type === 'BUY' || order.txn_type === 'B') {
                totalBuy += qty;
            } else if (order.txn_type === 'SELL' || order.txn_type === 'S') {
                totalSell += qty;
            }
        }
    });

    const netQuantity = totalBuy - totalSell;

    return {
        netQuantity,
        totalBuy,
        totalSell,
        isLong: netQuantity > 0,
        isShort: netQuantity < 0,
        isNeutral: netQuantity === 0
    };
}

/**
 * Check if it's safe to execute a trade
 * Returns true if safe, false with warning message if not
 */
export function canExecuteTrade(
    orders: ProcessedOrder[],
    securityId: string,
    intendedAction: 'BUY' | 'SELL'
): { canTrade: boolean; warning?: string } {
    const position = calculateNetPosition(orders, securityId);

    // If going LONG (BUY) but already SHORT
    if (intendedAction === 'BUY' && position.isShort) {
        return {
            canTrade: false,
            warning: `⚠️ Cannot go LONG - existing SHORT position detected (net: ${position.netQuantity}). BUY will close SHORT instead!`
        };
    }

    // If going SHORT (SELL) but already LONG
    if (intendedAction === 'SELL' && position.isLong) {
        return {
            canTrade: false,
            warning: `⚠️ Cannot go SHORT - existing LONG position detected (net: ${position.netQuantity}). SELL will close LONG instead!`
        };
    }

    // Safe to trade (NEUTRAL or same direction)
    return { canTrade: true };
}
