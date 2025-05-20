import { Hono } from 'hono'

const connectedClients = new Map<string, Set<string>>()

export function connect(channel: string, uuid: string) {
  if (!connectedClients.has(channel)) connectedClients.set(channel, new Set())
  connectedClients.get(channel)?.add(uuid)
}

export function disconnect(channel: string, uuid: string) {
  const clients = connectedClients.get(channel)
  if (clients) {
    clients.delete(uuid)
    if (clients.size === 0) connectedClients.delete(channel)
  }
}


export const app = new Hono()
app.get('/online', (c) => {
  const channel = c.req.query('channel')

  if (!channel) return c.json({ message: 'No channel provided' }, 400)

  return c.json({ clientsCount: connectedClients.get(channel)?.size || 0 })
})