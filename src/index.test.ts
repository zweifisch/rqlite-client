import { Client, QueryError } from './index'

const client = new Client([
    'http://localhost:4001',
    'http://localhost:4003',
    'http://localhost:4005',
    'http://localhost:4007'
])

test('concurrency', async () => {
    let statuses = await Promise.all([
        client.status(),
        client.status(),
        client.status(),
    ])
})

test('create table', async () => {
    let result = await client.exec(`\
CREATE TABLE if not exists account (
id integer not null primary key,
name text,
balance integer not null default 0)`)
})

test('insertion', async () => {
    await client.exec('INSERT INTO account(name, balance) VALUES("foo", 10)')
    await client.exec('INSERT INTO account(name, balance) VALUES("bar", 10)')
})

test('atomic operation', async () => {
    let results = await client.batch([
        'update account set balance = balance - 1 where name = "foo"',
        'update account set balance = balance + 1 where name = "bar"',
    ])
})

test('select', async () => {
    let queryResult = await client.query('select name,balance from account')
    expect(queryResult.values).toEqual([['foo', 9], ['bar', 11]])
})

test('deletion', async () => {
    let result = await client.exec('delete from account')
})

test('err', async () => {
    await expect(client.exec('delete from acc')).rejects.toEqual(new QueryError('no such table: acc'))
    await expect(client.query('select * from acc')).rejects.toEqual(new QueryError('no such table: acc'))
})
