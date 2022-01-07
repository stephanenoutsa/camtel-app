import fs from 'fs'

import axios from 'axios'
import FormData from 'form-data'

const PREDICT_URL = 'http://137.184.12.159/predict'

export const getDigitsFromCaptchaImage = async img => {
    const formData = new FormData()
    formData.append('image', fs.createReadStream(img))

    const formHeaders = formData.getHeaders();

    const { data: prediction } = await axios.post(PREDICT_URL, formData, {
        headers: { ...formHeaders }
    })

    return prediction
}
