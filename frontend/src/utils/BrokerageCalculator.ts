/**
 * Intraday Brokerage Calculator
 * 
 * Calculates all trading costs for equity intraday trades on NSE/BSE.
 * Based on standard Indian broker fee structure.
 * 
 * Fees breakdown (Equity Intraday):
 * - Brokerage: ₹20 or 0.03% per order (whichever is lower)
 * - Transaction charges: NSE: 0.00297%, BSE: 0.00375%
 * - STT (Securities Transaction Tax): 0.025% on SELL side only
 * - SEBI Turnover fees: 0.0001% on both sides
 * - Stamp Duty: 0.003% on BUY side only
 * - IPFT Contribution: 0.0001% on both sides
 * - GST: 18% on (Brokerage + Transaction charges + SEBI fees + IPFT)
 */

export interface TradeCosts {
    brokerage: number;
    transactionCharges: number;
    stt: number;           // Securities Transaction Tax (sell side only)
    sebiCharges: number;
    stampDuty: number;     // Buy side only
    ipftCharges: number;
    gst: number;
    totalCost: number;
}

export interface TradeDetails {
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    exchange?: 'NSE' | 'BSE';
}

// Fee rates for Equity Intraday
const FEES = {
    // Brokerage: ₹20 or 0.03% per order (whichever is lower)
    BROKERAGE_FLAT: 20,
    BROKERAGE_PERCENT: 0.0003,  // 0.03%

    // Transaction charges by exchange
    TRANSACTION_NSE: 0.0000297,  // 0.00297%
    TRANSACTION_BSE: 0.0000375,  // 0.00375%

    // STT - only on sell side for intraday
    STT_SELL: 0.00025,  // 0.025%

    // SEBI Turnover fees - both sides
    SEBI: 0.000001,  // 0.0001%

    // Stamp Duty - only on buy side
    STAMP_DUTY_BUY: 0.00003,  // 0.003%

    // IPFT - both sides
    IPFT: 0.000001,  // 0.0001%

    // GST on applicable charges
    GST: 0.18,  // 18%
};

/**
 * Calculate brokerage for a single leg (buy or sell)
 * Returns the lower of ₹20 or 0.03% of turnover
 */
function calculateBrokerage(turnover: number): number {
    const percentBrokerage = turnover * FEES.BROKERAGE_PERCENT;
    return Math.min(FEES.BROKERAGE_FLAT, percentBrokerage);
}

/**
 * Calculate all trading costs for an intraday trade (buy + sell)
 * 
 * @param trade - Trade details including prices and quantity
 * @returns Detailed breakdown of all costs
 */
export function calculateIntradayTradeCosts(trade: TradeDetails): TradeCosts {
    const { buyPrice, sellPrice, quantity, exchange = 'NSE' } = trade;

    const buyTurnover = buyPrice * quantity;
    const sellTurnover = sellPrice * quantity;
    const totalTurnover = buyTurnover + sellTurnover;

    // 1. Brokerage: ₹20 or 0.03% per order (whichever is lower)
    // Applied to both buy and sell orders
    const brokerageBuy = calculateBrokerage(buyTurnover);
    const brokerageSell = calculateBrokerage(sellTurnover);
    const brokerage = brokerageBuy + brokerageSell;

    // 2. Transaction charges: Based on exchange, applied to both sides
    const transactionRate = exchange === 'NSE' ? FEES.TRANSACTION_NSE : FEES.TRANSACTION_BSE;
    const transactionCharges = totalTurnover * transactionRate;

    // 3. STT: 0.025% on SELL side ONLY for intraday
    const stt = sellTurnover * FEES.STT_SELL;

    // 4. SEBI charges: 0.0001% on both sides
    const sebiCharges = totalTurnover * FEES.SEBI;

    // 5. Stamp Duty: 0.003% on BUY side ONLY
    const stampDuty = buyTurnover * FEES.STAMP_DUTY_BUY;

    // 6. IPFT: 0.0001% on both sides
    const ipftCharges = totalTurnover * FEES.IPFT;

    // 7. GST: 18% on (Brokerage + Transaction charges + SEBI + IPFT)
    // Note: GST is NOT charged on STT and Stamp Duty
    const gstableAmount = brokerage + transactionCharges + sebiCharges + ipftCharges;
    const gst = gstableAmount * FEES.GST;

    // Total cost
    const totalCost = brokerage + transactionCharges + stt + sebiCharges + stampDuty + ipftCharges + gst;

    return {
        brokerage: parseFloat(brokerage.toFixed(2)),
        transactionCharges: parseFloat(transactionCharges.toFixed(4)),
        stt: parseFloat(stt.toFixed(2)),
        sebiCharges: parseFloat(sebiCharges.toFixed(4)),
        stampDuty: parseFloat(stampDuty.toFixed(4)),
        ipftCharges: parseFloat(ipftCharges.toFixed(4)),
        gst: parseFloat(gst.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
    };
}

/**
 * Calculate net P&L after all trading costs
 * 
 * @param trade - Trade details
 * @returns Net profit/loss after deducting all costs
 */
export function calculateNetPnL(trade: TradeDetails): {
    grossPnL: number;
    costs: TradeCosts;
    netPnL: number;
} {
    const { buyPrice, sellPrice, quantity } = trade;

    const grossPnL = (sellPrice - buyPrice) * quantity;
    const costs = calculateIntradayTradeCosts(trade);
    const netPnL = grossPnL - costs.totalCost;

    return {
        grossPnL: parseFloat(grossPnL.toFixed(2)),
        costs,
        netPnL: parseFloat(netPnL.toFixed(2)),
    };
}

/**
 * Get a summary string of all costs for display
 */
export function getCostSummary(costs: TradeCosts): string {
    return `Brokerage: ₹${costs.brokerage} | STT: ₹${costs.stt} | Txn: ₹${costs.transactionCharges} | ` +
        `Stamp: ₹${costs.stampDuty} | SEBI: ₹${costs.sebiCharges} | IPFT: ₹${costs.ipftCharges} | ` +
        `GST: ₹${costs.gst} | Total: ₹${costs.totalCost}`;
}
