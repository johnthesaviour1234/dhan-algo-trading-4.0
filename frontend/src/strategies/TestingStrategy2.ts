import { toast } from '../components/Toast';

interface Trade {
    id: string;
    entryDate: string;
    exitDate: string;
    direction: 'Long' | 'Short';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    duration: string;
    signal: 'Buy' | 'Sell';
    brokerage: number;
    slippage: number;
    indicators: Record<string, number | boolean | string>;
}

export class TestingStrategy2 {
    private isRunning = false;
    private buyInterval: NodeJS.Timeout | null = null;
    private exitTimeout: NodeJS.Timeout | null = null;
    private currentPosition: { entryTime: Date; entryPrice: number; orderId?: string; correlationId?: string } | null = null;
    private onTradeCallback: (trade: Trade) => void;
    private placeOrderFn: (type: 'BUY' | 'SELL', qty: number) => Promise<{ price?: number; orderId?: string; correlationId?: string }>;
    private tradeCount = 0;

    constructor(
        placeOrderFn: (type: 'BUY' | 'SELL', qty: number) => Promise<{ price?: number; orderId?: string; correlationId?: string }>,
        onTradeCallback: (trade: Trade) => void
    ) {
        this.placeOrderFn = placeOrderFn;
        this.onTradeCallback = onTradeCallback;
    }

    start() {
        console.log('🚀 Testing-2 strategy started');
        this.isRunning = true;

        // Execute first BUY immediately
        this.executeBuy();

        // Then generate BUY signal every 2 minutes (120000ms)
        this.buyInterval = setInterval(() => {
            if (this.currentPosition === null && this.isRunning) {
                this.executeBuy();
            }
        }, 120000); // 2 minutes
        console.error('❌ [Testing-2] BUY execution failed:', error);
        toast.error(`Testing-2: BUY failed - ${error.message}`);
        this.currentPosition = null;
    }
}

    async executeSell() {
    if (!this.isRunning || !this.currentPosition) return;

    try {
        console.log('📉 [Testing-2] Executing SELL signal...');

        // Place SELL order
        const result = await this.placeOrderFn('SELL', 1);

        const exitTime = new Date();
        const exitPrice = result.price || (this.currentPosition.entryPrice + 0.05); // Use actual price or simulate
        const { entryTime, entryPrice } = this.currentPosition;

        const pnl = (exitPrice - entryPrice) * 1;
        const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

        // Create trade record
        const trade: Trade = {
            id: `testing-2-${Date.now()}-${this.tradeCount++}`,
            entryDate: entryTime.toISOString().split('T')[0] + ' ' + entryTime.toTimeString().split(' ')[0],
            exitDate: exitTime.toISOString().split('T')[0] + ' ' + exitTime.toTimeString().split(' ')[0],
            direction: 'Long',
            entryPrice,
            exitPrice,
            quantity: 1,
            pnl: parseFloat(pnl.toFixed(2)),
            pnlPercent: parseFloat(pnlPercent.toFixed(2)),
            duration: '5s',
            signal: 'Buy',
            brokerage: 0.05,
            slippage: 0.01,
            indicators: {
                'Entry Time': entryTime.toTimeString().split(' ')[0],
                'Exit Time': exitTime.toTimeString().split(' ')[0],
                'Auto Trade': true,
                'Interval': '2min',
            }
        };

        toast.success(`Testing-2: SELL executed at ₹${exitPrice}, P&L: ₹${pnl.toFixed(2)}`);
        console.log(`✅ [Testing-2] SELL executed at ${exitTime.toISOString()}, price: ${exitPrice}, P&L: ${pnl}`);

        // Notify callback with trade
        this.onTradeCallback(trade);

        // Clear position
        this.currentPosition = null;
    } catch (error: any) {
        console.error('❌ [Testing-2] SELL execution failed:', error);
        toast.error(`Testing-2: SELL failed - ${error.message}`);
        this.currentPosition = null;
    }
}

stop() {
    console.log('🛑 Testing-2 strategy stopped');
    this.isRunning = false;

    if (this.buyInterval) {
        clearInterval(this.buyInterval);
        this.buyInterval = null;
    }

    if (this.exitTimeout) {
        clearTimeout(this.exitTimeout);
        this.exitTimeout = null;
    }

    this.currentPosition = null;
    toast.info('Testing-2 strategy stopped');
}

isActive(): boolean {
    return this.isRunning;
}
}
