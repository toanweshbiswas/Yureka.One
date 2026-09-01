import { communicateWwEvent, notifyWwPaymentSuccess } from './communicate.js'
import {
  getRegistration,
  getTrip,
  listRegistrations,
  markInstallmentOverdue,
} from './store.js'

const MS_DAY = 24 * 60 * 60 * 1000

export async function runWwReminders(): Promise<{ due: number; overdue: number }> {
  let dueCount = 0
  let overdueCount = 0
  const now = Date.now()
  const regs = await listRegistrations({})

  for (const row of regs) {
    const reg = row.registration
    if (reg.status === 'cancelled' || reg.status === 'paid') continue
    const trip = row.trip || (await getTrip(reg.tripId))
    if (!trip) continue
    const installments = row.installments

    for (const inst of installments) {
      if (inst.status !== 'due' && inst.status !== 'overdue') continue
      const dueMs = new Date(inst.dueAt).getTime()
      if (!Number.isFinite(dueMs)) continue

      if (dueMs < now && inst.status === 'due') {
        const updated = await markInstallmentOverdue(inst.id)
        if (updated) {
          overdueCount += 1
          const payEmail = inst.claimedByEmail || reg.buyerEmail
          const payUserId = inst.claimedByUserId || reg.userId
          void communicateWwEvent({
            event: 'installment_overdue',
            userId: payUserId.startsWith('group:') ? payEmail : payUserId,
            email: payEmail,
            payload: { registration: reg, installment: updated, trip },
          })
        }
      } else if (inst.status === 'due' && dueMs - now <= 3 * MS_DAY && dueMs > now) {
        dueCount += 1
        const payEmail = inst.claimedByEmail || reg.buyerEmail
        const payUserId = inst.claimedByUserId || reg.userId
        void communicateWwEvent({
          event: 'installment_due',
          userId: payUserId.startsWith('group:') ? payEmail : payUserId,
          email: payEmail,
          payload: { registration: reg, installment: inst, trip, dueAt: inst.dueAt },
        })
      }
    }
  }

  if (dueCount || overdueCount) {
    console.info('[wanderworld] reminders sent', { due: dueCount, overdue: overdueCount })
  }
  return { due: dueCount, overdue: overdueCount }
}

export function scheduleWwReminders() {
  const run = () => {
    void runWwReminders().catch((e) => console.warn('[wanderworld] reminders failed:', e?.message || e))
  }
  run()
  setInterval(run, 24 * 60 * 60 * 1000)
}
