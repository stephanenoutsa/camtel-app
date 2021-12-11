import express from 'express'
import bodyParser from 'body-parser'

import { V0IndexRouter } from './services/v0/index.router.js'

const app = express()
const port = process.env.PORT || 1000

// Parse bodies of requests with bodies
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// CORS Should be restricted
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  )
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD')

  next()
})

// API v0 routes
app.use('/api/v0/', V0IndexRouter)

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`Press CTRL+C to stop server`)
})
