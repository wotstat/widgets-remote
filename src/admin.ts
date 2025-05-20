import { Hono } from "hono";
import { getAllChannels, stateForChannel } from "./state";
import { createMiddleware } from 'hono/factory'

export const app = new Hono()

const TOKEN = Bun.env.ADMIN_TOKEN;

const authMiddleware = createMiddleware(async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (!authorization) return c.json({ message: 'No authorization provided' }, 400)
  if (!authorization.startsWith('Bearer ')) return c.json({ message: 'Invalid authorization' }, 400)
  const token = authorization.split(' ').at(-1);
  if (token !== TOKEN) return c.json({ message: 'Invalid token' }, 401)
  return next()
})

app.get('/channel-list', authMiddleware, (c) => {
  return c.json(getAllChannels.all());
})

app.get('/channel-list/:channel', authMiddleware, (c) => {
  const channel = c.req.param('channel')
  if (!channel) return c.json({ message: 'No channel provided' }, 400)

  return c.json(stateForChannel(channel));
})