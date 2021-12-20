import { mkdir, unlink } from 'fs'

import puppeteer from 'puppeteer'

import { getDigitsFromCaptchaImage } from '../../captcha/captcha.service.js'
import { logger } from '../../../../../logger.js'
import offers from '../../camtel-offers.js'

const CAMTEL_LOGIN_URL = 'http://myxtremnet.cm/web/index!login.action'
const CAMTEL_FAILED_LOGIN_URL = 'http://myxtremnet.cm/web/user!gotowt.action'
const CAMTEL_BILLING_INFO_URL = 'http://myxtremnet.cm/web/billing-query!accountBalance.action'
const CAMTEL_PREPAID_BALANCE_SUBACCOUNT = 'PrepaidBalanceSubaccount'
const CAMTEL_OFFERS_URL = 'http://myxtremnet.cm/web/offer-subscription!getAvailableOffers.action?serviceNo='
const CAMTEL_SUBSCRIBE_SUCCESS_MESSAGES = ['Subscribe successfully!', 'Souscription effectuée avec succès!']
const CAMTEL_SUBSCRIBE_SYSTEM_ABNORMALITIES = 'System abnormalities,please try later!'

// Get account balance
export const getBalance = async (req, res) => {
    try {
        const { phone, password } = req.body

        // Validate password
        if (!phone || !password) {
            const message = 'Phone number of password not provided'

            logger.error(message)

            return res.status(422).json({ message })
        }

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disabled-setuid-sandbox']
        })
        const page = await browser.newPage()

        await page.goto(CAMTEL_LOGIN_URL)
        
        const loginForm = await page.$('#formLogin')
        const table = await loginForm.$('table.l_tb')
        const img = await table.$('#img1')

        const today = new Date().toISOString().substring(0, 10)
        const timestamp = Date.now()
        const dir = `images/${today}`
        mkdir(dir, { recursive: true }, err => {
            if (err) throw err
        })
        const path = `${dir}/${timestamp}.png`

        await img.screenshot({ path })

        const digits = await getDigitsFromCaptchaImage(path)

        // Remove file from filesystem
        unlink(path, err => {
            if (err) throw err
        })

        await page.type('#userVO_loginName1', phone)
        await page.type('#userVO_userPassword', password)
        await page.type('#checkCodes1', digits)

        await page.click('#regbutton')

        await page.waitForNavigation()

        const pageUrl = page.url()

        if (pageUrl === CAMTEL_FAILED_LOGIN_URL) {
            logger.error('Login attempt failed')

            return res.status(400).json({ message: 'Login attempt failed. Please try again' })
        }

        await page.goto(CAMTEL_BILLING_INFO_URL)

        const balanceDetails = []

        const accountInfoTable = await page.$('#accountInformation')
        const balanceTRs = await accountInfoTable.$$('tbody tr')

        if (!balanceTRs.length) {
            const message = 'Balance table rows not found'

            logger.error(message)

            return res.status(404).json({ message })
        }

        for (const balanceTR of balanceTRs) {
            const balanceTDEl = await balanceTR.$('td:first-child')
            
            if (!balanceTDEl) {
                continue
            }

            const balanceTDObj = await balanceTDEl.getProperty('innerText')
            const balanceTD = await balanceTDObj.jsonValue()

            const balanceEl = await balanceTR.$('td:nth-child(2)')
            const balanceObj = await balanceEl.getProperty('innerText')
            const balance = await balanceObj.jsonValue()

            const effectiveTimeEl = await balanceTR.$('td:nth-child(3)')
            const effectiveTimeObj = await effectiveTimeEl.getProperty('innerText')
            const effectiveTime = await effectiveTimeObj.jsonValue()

            const expiryTimeEl = await balanceTR.$('td:nth-child(4)')
            const expiryTimeObj = await expiryTimeEl.getProperty('innerText')
            const expiryTime = await expiryTimeObj.jsonValue()

            balanceDetails.push({ type: balanceTD, balance, effectiveTime, expiryTime })
        }

        await browser.close()

        if (!balanceDetails.length) {
            const message = 'An error occurred when trying to retrieve balance info'

            logger.error(message)

            return res.status(404).json({ message })
        }

        return res.json({ balanceDetails })
    } catch (error) {
        logger.error(error)

        return res.status(422).json(error)
    }
}

// Subscribe to offer
export const offerSubscription = async (req, res) => {
    try {
        const { phone, password, offer } = req.body

        // Validate password
        if (!phone || !password) {
            const message = 'Phone number or password not provided'

            logger.error(message)

            return res.status(422).json({ message })
        }

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disabled-setuid-sandbox']
        })
        const page = await browser.newPage()

        await page.goto(CAMTEL_LOGIN_URL)

        const loginForm = await page.$('#formLogin')
        const table = await loginForm.$('table.l_tb')
        const img = await table.$('#img1')

        const today = new Date().toISOString().substring(0, 10)
        const timestamp = Date.now()
        const dir = `images/${today}`
        mkdir(dir, { recursive: true }, err => {
            if (err) throw err
        })
        const path = `${dir}/${timestamp}.png`

        await img.screenshot({ path })

        const digits = await getDigitsFromCaptchaImage(path)

        // Remove file from filesystem
        unlink(path, err => {
            if (err) throw err
        })

        await page.type('#userVO_loginName1', phone)
        await page.type('#userVO_userPassword', password)
        await page.type('#checkCodes1', digits)

        await page.click('#regbutton')

        await page.waitForNavigation()

        const pageUrl = page.url()

        if (pageUrl === CAMTEL_FAILED_LOGIN_URL) {
            const message = 'Login attempt failed. Please try again'

            logger.error(message)

            return res.status(400).json({ message })
        }

        await page.goto(CAMTEL_BILLING_INFO_URL)

        const accountInfoTable = await page.$('#accountInformation')
        const balanceTRs = await accountInfoTable.$$('tbody tr')

        if (!balanceTRs.length) {
            const message = 'Balance table rows not found'

            logger.error(message)

            return res.status(404).json({ message })
        }

        let balance = null

        for (const balanceTR of balanceTRs) {
            const balanceTDEl = await balanceTR.$('td:first-child')
            
            if (!balanceTDEl) {
                continue
            }

            const balanceTDObj = await balanceTDEl.getProperty('innerText')
            const balanceTD = await balanceTDObj.jsonValue()

            if (balanceTD === CAMTEL_PREPAID_BALANCE_SUBACCOUNT) {
                const balanceEl = await balanceTR.$('td:nth-child(2)')
                const balanceObj = await balanceEl.getProperty('innerText')
                const balanceString = await balanceObj.jsonValue()
                const balanceArray = balanceString.split('.')
                balance = balanceArray.length ? parseInt(balanceArray[0]) : 0
            }
        }

        const requestedOffer = offers.find(o => o.name === offer)

        if (requestedOffer && (balance < requestedOffer.price)) {
            const message = 'Insufficient balance'

            logger.error(message)

            return res.status(422).json({ status: 'INSUFFICIENT_BALANCE', message })
        }

        await page.goto(`${CAMTEL_OFFERS_URL}${phone}`)

        const offersTable = await page.$('#infolistId')
        const offerEls = await offersTable.$$('ul')

        for (const offerEl of offerEls) {
            const list = await offerEl.$('li')

            const offerNameEl = await list.$('div')
            const offerNameObj = await offerNameEl.getProperty('innerText')
            const offerName = await offerNameObj.jsonValue()

            if (offer === offerName) {
                const link = await list.$('span a')
                
                await link.click()

                await page.waitForNavigation()

                // Listen for alert event before subscribing
                page.on('dialog', async dialog => {
                    await dialog.accept()
                })

                await page.click('#regbutton')

                await page.waitForNavigation()

                const responseTable = await page.$('.f_lin25')

                const td = await responseTable.$('tbody tr:nth-child(1) td')
                const tdObj = await td.getProperty('innerText')
                const response = await tdObj.jsonValue()

                if (!CAMTEL_SUBSCRIBE_SUCCESS_MESSAGES.includes(response)) {
                    await browser.close()

                    const status = response === CAMTEL_SUBSCRIBE_SYSTEM_ABNORMALITIES ?
                        'SYSTEM_ABNORMALITIES' :
                        'FAILED'
                    
                    logger.error(response)

                    return res.status(422).json({ status, message: response })
                }

                await browser.close()

                return res.json({ status: 'SUCCESSFUL', message: response })
            }
        }

        await browser.close()

        logger.error('Something unexpected happened')

        return res.status(500).json({ message: 'Something unexpected happened' })
    } catch (error) {
        logger.error(error)

        return res.status(422).json({ status: 'FAILED', message: error })
    }
}
