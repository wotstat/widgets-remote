import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { connect, disconnect, app as onlineApp } from './online'
import { app as stateApp, stateForChannel } from './state'
import { app as adminApp } from './admin'

const app = new Hono()
app.use(cors())
app.route('/', onlineApp)
app.route('/', stateApp)
app.route('/admin', adminApp)

app.get('/', (c) => {
  const uuid = c.req.query('uuid')
  const channel = c.req.query('channel')

  if (!uuid) return c.json({ message: 'No uuid provided' }, 400)
  if (!channel) return c.json({ message: 'No channel provided' }, 400)

  const success = server.upgrade(c.req.raw, { data: { uuid, channel } });
  if (success) return new Response(null);

  return c.json({ message: 'Redirecting...' })
})

export const server = Bun.serve<{ uuid: string, channel: string }>({
  fetch: app.fetch,
  websocket: {
    open(ws) {
      const { channel, uuid } = ws.data;
      ws.subscribe(channel);
      connect(channel, uuid);
      ws.send(JSON.stringify(stateForChannel(channel)));
    },
    message(ws, message) {
      if (message === "ping") {
        ws.send("pong");
        return;
      }
    },
    close(ws) {
      const { channel, uuid } = ws.data;
      ws.unsubscribe(channel);
      disconnect(channel, uuid);
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);