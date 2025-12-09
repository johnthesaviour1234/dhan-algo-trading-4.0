/**
 * Market Hours Utility
 * 
 * Provides helpers for checking if current time is within Indian stock market
 * trading hours (9:30 AM - 2:30 PM IST for intraday).
 */

export class MarketHours {
    // Market hours (IST) - Intraday trading window
    private static readonly MARKET_OPEN_HOUR = 9;
    private static readonly MARKET_OPEN_MINUTE = 30;  // 9:30 AM
    private static readonly MARKET_CLOSE_HOUR = 14;
    private static readonly MARKET_CLOSE_MINUTE = 30; // 2:30 PM (forced close)

    /**
     * Get current time in IST as minutes from midnight
     */
    static getCurrentISTMinutes(): number {
        const now = new Date();
        // Convert to IST (UTC+5:30)
        const istOffset = 5.5 * 60; // minutes
        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const istMinutes = (utcMinutes + istOffset) % (24 * 60);
        return istMinutes;
    }

    /**
     * Get market open time in minutes from midnight (9:30 AM = 570)
     */
    static getMarketOpenMinutes(): number {
        return this.MARKET_OPEN_HOUR * 60 + this.MARKET_OPEN_MINUTE; // 570
    }

    /**
     * Get market close time in minutes from midnight (2:30 PM = 870)
     */
    static getMarketCloseMinutes(): number {
        return this.MARKET_CLOSE_HOUR * 60 + this.MARKET_CLOSE_MINUTE; // 870
    }

    /**
     * Check if current IST time is within trading hours (9:30 AM - 2:30 PM)
     */
    static isWithinTradingHours(): boolean {
        const currentMinutes = this.getCurrentISTMinutes();
        const openMinutes = this.getMarketOpenMinutes();
        const closeMinutes = this.getMarketCloseMinutes();
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }

    /**
     * Check if it's at or past force close time (2:30 PM IST)
     */
    static isForceCloseTime(): boolean {
        const currentMinutes = this.getCurrentISTMinutes();
        const closeMinutes = this.getMarketCloseMinutes();
        return currentMinutes >= closeMinutes;
    }

    /**
     * Check if market is open today (weekday check)
     */
    static isMarketDay(): boolean {
        const now = new Date();
        const day = now.getDay();
        // 0 = Sunday, 6 = Saturday
        return day >= 1 && day <= 5;
    }

    /**
     * Get minutes until market opens (negative if already open)
     */
    static getMinutesUntilMarketOpen(): number {
        const currentMinutes = this.getCurrentISTMinutes();
        const openMinutes = this.getMarketOpenMinutes();
        return openMinutes - currentMinutes;
    }

    /**
     * Get minutes until market closes (negative if already closed)
     */
    static getMinutesUntilMarketClose(): number {
        const currentMinutes = this.getCurrentISTMinutes();
        const closeMinutes = this.getMarketCloseMinutes();
        return closeMinutes - currentMinutes;
    }

    /**
     * Get formatted current IST time
     */
    static getCurrentISTTimeString(): string {
        const now = new Date();
        return now.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
}
