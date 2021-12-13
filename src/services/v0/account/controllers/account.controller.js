import puppeteer from 'puppeteer'

import { getDigitsFromCaptchaImage } from '../../captcha/captcha.service.js'

const CAMTEL_LOGIN_URL = 'http://myxtremnet.cm/web/index!login.action'
const CAMTEL_FAILED_LOGIN_URL = 'http://myxtremnet.cm/web/user!gotowt.action'
const CAMTEL_BILLING_INFO_URL = 'http://myxtremnet.cm/web/billing-query!accountBalance.action'
const CAMTEL_OFFERS_URL = 'http://myxtremnet.cm/web/offer-subscription!getAvailableOffers.action?serviceNo='
const CAMTEL_SUBSCRIBED_OFFER_URL = 'http://myxtremnet.cm/web/offer-subscription!subscribedOffer.action'

// Get account balance
export const getBalance = async (req, res) => {
    try {
        const { phone, password } = req.body

        // Validate password
        if (!phone || !password) {
            return res.status(422).json({ message: 'Phone number or password not provided' })
        }

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disabled-setuid-sandbox']
        })
        const page = await browser.newPage()

        await page.goto(CAMTEL_LOGIN_URL)
        
        const loginForm = await page.$('#formLogin')
        const tables = await loginForm.$$('table.l_tb')

        if (!tables.length) {
            return res.status(404).json({ message: 'Login form table element not found' })
        }

        const table = tables[0]
        const images = await table.$$('img')

        if (!images.length) {
            return res.status(404).json({ message: 'Login form image element not found' })
        }

        const img = images[0]
        await img.screenshot({ path: 'image.png' })

        const digits = await getDigitsFromCaptchaImage('image.png')
        console.log('DIGITS', digits)

        await page.type('#userVO_loginName1', phone)
        await page.type('#userVO_userPassword', password)
        await page.type('#checkCodes1', digits)

        await page.click('#regbutton')

        await page.waitForNavigation()

        const pageUrl = page.url()

        if (pageUrl === CAMTEL_FAILED_LOGIN_URL) {
            return res.status(400).json({ message: 'Login attempt failed. Please try again' })
        }

        await page.goto(CAMTEL_BILLING_INFO_URL)

        const accountInfoTable = await page.$('#accountInformation')
        const balanceEl = await accountInfoTable.$('tbody tr:nth-child(3) td:nth-child(2)')
        const balanceObj = await balanceEl.getProperty('innerText')
        const balance = await balanceObj.jsonValue()

        await browser.close()

        return res.json({ balance })
    } catch (error) {
        console.log('ERROR', error)
        return res.status(422).json(error)
    }
}

// Subscribe to offer
export const offerSubscription = async (req, res) => {
    try {
        const { phone, password, offer } = req.body

        // Validate password
        if (!phone || !password) {
            return res.status(422).json({ message: 'Phone number or password not provided' })
        }

        const browser = await puppeteer.launch()
        const page = await browser.newPage()

        await page.goto(CAMTEL_LOGIN_URL)
        
        const loginForm = await page.$('#formLogin')
        const tables = await loginForm.$$('table.l_tb')

        if (!tables.length) {
            return res.status(404).json({ message: 'Login form table element not found' })
        }

        const table = tables[0]
        const images = await table.$$('img')

        if (!images.length) {
            return res.status(404).json({ message: 'Login form image element not found' })
        }

        const img = images[0]
        await img.screenshot({ path: 'image.png' })

        const digits = await getDigitsFromCaptchaImage('image.png')
        console.log('DIGITS', digits)

        await page.type('#userVO_loginName1', phone)
        await page.type('#userVO_userPassword', password)
        await page.type('#checkCodes1', digits)

        await page.click('#regbutton')

        await page.waitForNavigation()

        const pageUrl = page.url()

        if (pageUrl === CAMTEL_FAILED_LOGIN_URL) {
            return res.status(400).json({ message: 'Login attempt failed. Please try again' })
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

                if (page.url().startsWith(CAMTEL_SUBSCRIBED_OFFER_URL)) {
                    return res.status(400).json({ message: 'Insufficient funds' })
                }
            }
        }

        await browser.close()

        return res.json({ message: 'Subscription successful' })
    } catch (error) {
        console.log('ERROR', error)
        return res.status(422).json(error)
    }
}
