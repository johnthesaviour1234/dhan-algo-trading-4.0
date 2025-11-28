import type { Trade } from '../components/BacktestingPanel';

type PlaceOrderFunc = (type: 'BUY' | 'SELL', qty: number) => Promise<{ price?: number; orderId?: string; correlationId?: string }>;
type OnTradeFunc = (trade: Trade) => void;

/**
 * Testing Strategy 3 - SHORT Selling Strategy (1-minute interval)
 * - Opens SHORT position by SELLING
 * - Closes SHORT position by BUYING back after 5 seconds
 * - Repeats every 1 minute
 */
export class TestingStrategy3 {
    private isRunning: boolean = false;
    private placeOrder: PlaceOrderFunc;
    private onTrade: OnTradeFunc;
    private intervalId?: ReturnType<typeof setInterval>;
    private currentPosition: { type: 'SHORT'; entryPrice: number; entryTime: Date; orderId?: string; correlationId?: string } | null = null;

    constructor(placeOrder: PlaceOrderFunc, onTrade: OnTradeFunc) {
        this.placeOrder = placeOrder;
        this.onTrade = onTrade;
    }

    start() {
        if (this.isRunning) {
            console.warn('⚠️ Testing-3 strategy already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Testing-3 strategy started (SHORT - 1min interval)');

        // Execute first SELL immediately
        setTimeout(() => {
            this.executeSell();
        }, 0);

        // Then execute SELL every 1 minute (60,000ms)
        this.intervalId = setInterval(() => {
            if (this.isRunning && !this.currentPosition) {
                this.executeSell();
            }
        }, 60000); // 1 minute
    }

    private async executeSell() {
        if (!this.isRunning || this.currentPosition) return;

        try {
            console.log('📉 Executing SELL signal (open SHORT)...');
            const result = await this.placeOrder('SELL', 1);
            const sellPrice = result.price || 0;
            const sellTime = new Date();

            console.log(`✅ SELL executed at ${sellTime.toISOString()}, price: ${sellPrice}`);

            // Store SHORT position
            this.currentPosition = {
                type: 'SHORT',
                entryPrice: sellPrice,
                entryTime: sellTime,
                orderId: result.orderId,
                correlationId: result.correlationId
            };

            console.log(`📋 Order ID: ${result.orderId}`);
            console.log(`🏷️  Correlation ID: ${result.correlationId}`);

            // Close SHORT position after 5 seconds
            setTimeout(() => {
                this.executeBuy();
            }, 5000);

        } catch (error: any) {
            console.error('❌ SELL execution failed:', error);
        }
    }

    private async executeBuy() {
        if (!this.isRunning || !this.currentPosition) return;

        try {
            console.log('📈 Executing BUY signal (close SHORT)...');
            const result = await this.placeOrder('BUY', 1);
            const buyPrice = result.price || 0;
            const buyTime = new Date();

            // Calculate P&L (SHORT: profit when sell high, buy low)
            const pnl = this.currentPosition.entryPrice - buyPrice;
            const pnlPercent = ((this.currentPosition.entryPrice - buyPrice) / this.currentPosition.entryPrice) * 100;

            console.log(`✅ BUY executed at ${buyTime.toISOString()}, price: ${buyPrice}, P&L: ${pnl}`);

            // Create trade record
            const trade: Trade = {
                id: `testing3-${Date.now()}`,
                entryDate: this.currentPosition.entryTime.toISOString(),
                exitDate: buyTime.toISOString(),
                direction: 'Short',
                entryPrice: this.currentPosition.entryPrice,
                exitPrice: buyPrice,
                quantity: 1,
                pnl: pnl,
                pnlPercent: pnlPercent,
                duration: '5s',
                signal: 'Sell',
                brokerage: 0,
                slippage: 0
            };

            this.onTrade(trade);

            // Clear position
            this.currentPosition = null;

        } catch (error: any) {
            console.error('❌ BUY execution failed:', error);
            this.currentPosition = null;
        }
    }

    stop() {
        console.log('🛑 Testing-3 strategy stopped');
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.currentPosition = null;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            hasPosition: this.currentPosition !== null,
            positionType: this.currentPosition?.type
        };
    }
}
