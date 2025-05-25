
import { Hono } from 'hono'
import { Database } from "bun:sqlite";
import { server } from ".";

const StateDB = new Database('./SQLite/remote-state.sqlite', { create: true })
StateDB.exec(`
  create table if not exists Storage (
    channel    TEXT    NOT NULL,
    key        TEXT    NOT NULL,
    value      TEXT    NOT NULL,
    value_type TEXT    NOT NULL
                  check (value_type IN ('string', 'boolean', 'number')),
    last_usage  INTEGER NOT NULL 
                  default (strftime('%s','now')),
    primary key (channel, key)
  )
`)

const getStateForChannel = StateDB.query(`
  select
    key,
    value_type,
    CASE value_type
      WHEN 'number'  THEN CAST(value AS REAL)
      WHEN 'boolean' THEN (value = 'true')
      ELSE value
    END AS typed_value
  FROM Storage
  WHERE channel = $channel;
`)

export const getAllChannels = StateDB.query(`select distinct channel from Storage`)

const setState = StateDB.query(`insert or replace into Storage (channel, key, value, value_type) values ($channel, $key, $value, $value_type)`)
const removeOldStates = StateDB.query(`delete from Storage where last_usage < strftime('%s','now','-30 days')`)

export function stateForChannel(channel: string) {
  const data = getStateForChannel.all({ $channel: channel }) as {
    key: string,
    value_type: 'string' | 'boolean' | 'number',
    typed_value: string | number | boolean
  }[]
  const state = Object.fromEntries(data.map((row) => [row.key, row.value_type == 'boolean' ? Boolean(row.typed_value) : row.typed_value]))
  return state
}

const hasher = new Bun.CryptoHasher("sha256");

export const app = new Hono()
app.post('/state', async c => {
  const channelKey = c.req.query('private-key')

  if (!channelKey) return c.json({ message: 'No channel-key provided' }, 400)

  const channel = hasher.update(channelKey).digest('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);

  const body = await c.req.json()
  if (!body) return c.json({ message: 'No body provided' }, 400)
  if (typeof body !== 'object') return c.json({ message: 'Body must be an object' }, 400)

  const keys = Object.keys(body)
  if (keys.length === 0) return c.json({ message: 'No keys provided' }, 400)

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') setState.run({ $channel: channel, $key: key, $value: value, $value_type: 'string' })
    else if (typeof value === 'number') setState.run({ $channel: channel, $key: key, $value: String(value), $value_type: 'number' })
    else if (typeof value === 'boolean') setState.run({ $channel: channel, $key: key, $value: String(value), $value_type: 'boolean' })
  }

  server.publish(channel, JSON.stringify(stateForChannel(channel)))

  return c.json({ message: 'State sent' })
})

app.get('/state', c => {
  const channel = c.req.query('channel')

  if (!channel) return c.json({ message: 'No channel provided' }, 400)

  const state = stateForChannel(channel)
  return c.json(state)
})