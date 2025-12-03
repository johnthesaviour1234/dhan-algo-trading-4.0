/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 * 
 * This verification logic is FLAWED and has been removed from all strategies.
 * 
 * Problem: This checks order FULFILLMENT status (PENDING, TRADED, etc.) which
 * indicates if the initial order was executed by the broker. It does NOT check
 * whether the position was subsequently CLOSED (i.e., a bought share was sold,
 * or a sold share was bought back).
 * 
 * This file is kept for reference only. All strategies now directly place
 * closing orders without this incorrect verification step.
 */

import { API_URL } from '../config/api';

/**
 * @deprecated This function checks order execution status, NOT position closure status
 * Verify if an order is still open and can be closed
 * @param orderId - Dhan order ID
 * @param correlationId - Optional fallback correlation ID
 * @returns Order status information
 */
export async function verifyOrderStatus(
    orderId?: string,
    correlationId?: string
): Promise<{
    canClose: boolean;
    status: string;
    reason?: string;
    order?: any;
}> {
    try {
        // Try orderId first (faster)
        if (orderId) {
            console.log(`🔍 Verifying order status: ${orderId}`);

            const response = await fetch(`${API_URL}/api/orders/${orderId}`);
            const data = await response.json();

            if (response.ok && data.success) {
                const order = data.order;

                // Check if order is still open and has remaining quantity
                if (order.orderStatus === 'PENDING' || order.orderStatus === 'TRANSIT') {
                    console.log(`✅ Order ${orderId} is open - safe to close`);
                    return {
                        canClose: true,
                        status: order.orderStatus,
                        order: order
                    };
                }

                // Order already fully traded
                if (order.orderStatus === 'TRADED' && order.remainingQuantity === 0) {
                    console.log(`⚠️  Order ${orderId} already fully traded`);
                    return {
                        canClose: false,
                        status: 'ALREADY_CLOSED',
                        reason: 'Order was already fully traded',
                        order: order
                    };
                }

                // Order partially traded - can still close remaining
                if (order.orderStatus === 'PART_TRADED' && order.remainingQuantity > 0) {
                    console.log(`⚠️  Order ${orderId} partially traded, can close remaining`);
                    return {
                        canClose: true,
                        status: 'PARTIAL',
                        order: order
                    };
                }

                // Order was cancelled or rejected
                if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED' || order.orderStatus === 'EXPIRED') {
                    console.log(`❌ Order ${orderId} was ${order.orderStatus}`);
                    return {
                        canClose: false,
                        status: order.orderStatus,
                        reason: `Order was ${order.orderStatus.toLowerCase()}`,
                        order: order
                    };
                }
            }
        }

        // Fallback to correlation ID if orderId failed
        if (correlationId) {
            console.log(`🔍 Trying correlation ID lookup: ${correlationId}`);

            const response = await fetch(`${API_URL}/api/orders/correlation/${encodeURIComponent(correlationId)}`);
            const data = await response.json();

            if (response.ok && data.success) {
                const order = data.order;

                if (order.orderStatus === 'PENDING' || order.orderStatus === 'TRANSIT') {
                    return { canClose: true, status: order.orderStatus, order: order };
                }

                if (order.orderStatus === 'TRADED' && order.remainingQuantity === 0) {
                    return {
                        canClose: false,
                        status: 'ALREADY_CLOSED',
                        reason: 'Order was already traded',
                        order: order
                    };
                }
            }
        }

        // If both lookups failed
        console.warn('⚠️  Could not verify order status - assuming safe to close');
        return {
            canClose: true,
            status: 'UNKNOWN',
            reason: 'Could not verify - proceeding with caution'
        };
    } catch (error: any) {
        console.error('❌ Error verifying order status:', error.message);
        // On error, assume safe to close (fail-open for now)
        return {
            canClose: true,
            status: 'ERROR',
            reason: `Verification failed: ${error.message}`
        };
    }
}
