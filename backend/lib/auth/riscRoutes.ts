import type { Express, Request, Response } from 'express'
import express from 'express'
import { handleRiscPayload, validateRiscToken } from './risc.js'

export function registerRiscRoutes(app: Express) {
  app.post(
    '/api/auth/google-risc',
    express.text({ type: '*/*', limit: '512kb' }),
    async (req: Request, res: Response) => {
      try {
        const raw = typeof req.body === 'string' ? req.body.trim() : ''
        if (!raw) {
          res.status(400).json({ error: 'Empty security event token' })
          return
        }
        const payload = await validateRiscToken(raw)
        const result = await handleRiscPayload(payload)
        res.status(202).json({ accepted: true, ...result })
      } catch (e: any) {
        const msg = e?.message || 'Invalid security event token'
        console.warn('[risc] reject:', msg)
        res.status(400).json({ error: msg })
      }
    },
  )
}
