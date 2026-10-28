import process from 'node:process'
import { createHubServer } from './server'

// Same port as the real hub, so swapping it in later only changes the image.
const port = Number(process.env.PORT ?? 8100)

// Caged services must listen on 0.0.0.0 for the relay to reach them.
createHubServer().listen(port, '0.0.0.0', () => {
  console.log(`hub stub listening on :${port}`)
})
