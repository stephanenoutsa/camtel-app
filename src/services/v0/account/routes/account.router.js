import { Router } from 'express'

import { getBalance, offerSubscription } from '../controllers/account.controller.js'

const router = Router()

// Get account balance
router.post('/get-balance', getBalance)

// Subscribe to offer
router.post('/offer-subscribe', offerSubscription)

export const AccountRouter = router
