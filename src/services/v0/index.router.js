import { Router } from 'express'

import { AccountRouter } from './account/routes/account.router.js'

const router = Router()

router.use('/account', AccountRouter)

export const V0IndexRouter = router
