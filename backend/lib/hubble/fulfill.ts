import {
  getHubbleOrderByReference,
  placeHubbleOrder,
} from './client.js'
import { applyHubbleOrderResult, getOrderById } from './store.js'
import type { StoredOrder } from './types.js'
import { notifyGiftCardFailed, notifyGiftCardFulfilled } from '../notifications/notify.js'

async function notifyGiftCardOutcome(order: StoredOrder) {
  const payload = {
    userId: order.userId,
    email: order.customerEmail,
    orderId: order.id,
    productTitle: order.productTitle,
    amountInr: order.amountInr,
  }
  if (order.status === 'SUCCESS') {
    await notifyGiftCardFulfilled(payload)
  } else if (order.status === 'FAILED') {
    await notifyGiftCardFailed(payload)
  }
}

/** After Razorpay (or direct issue) has been confirmed, debit Hubble and attach vouchers. */
export async function fulfillGiftCardWithHubble(order: StoredOrder): Promise<StoredOrder> {
  if (order.hubbleOrderId && (order.status === 'SUCCESS' || order.status === 'PROCESSING')) {
    return (await getOrderById(order.id)) || order
  }

  let remote
  try {
    remote = await placeHubbleOrder({
      productId: order.productId,
      referenceId: order.referenceId,
      amount: order.amountInr,
      denominationDetails: [{ denomination: order.denomination, quantity: order.quantity }],
      customerDetails: {
        name: order.customerName || 'Yureka User',
        phoneNumber: order.customerPhone || '9999999999',
        email: order.customerEmail || 'noreply@yureka.one',
      },
    })
  } catch (e: any) {
    try {
      remote = await getHubbleOrderByReference(order.referenceId)
    } catch {
      const failed = await applyHubbleOrderResult(order.id, {
        id: '',
        referenceId: order.referenceId,
        status: 'FAILED',
        vouchers: [],
        failureReason: e?.message || 'Voucher issue failed after payment. Contact support for a retry or refund.',
      })
      const next = failed || order
      await notifyGiftCardOutcome(next)
      return next
    }
  }

  const fulfilled = (await applyHubbleOrderResult(order.id, remote)) || order
  await notifyGiftCardOutcome(fulfilled)
  return fulfilled
}
