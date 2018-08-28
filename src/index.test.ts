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
    expect(await client.exec('INSERT INTO account(name, balance) VALUES("foo", 10)')).toHaveProperty('rows_affected', 1)
    expect(await client.exec('INSERT INTO account(name, balance) VALUES("bar", 10)')).toHaveProperty('last_insert_id')
})

test('atomic operation', async () => {
    let [r1, r2] = await client.batch([
        'update account set balance = balance - 1 where name = "foo"',
        'update account set balance = balance + 1 where name = "bar"',
    ])
    expect(r1).toHaveProperty('rows_affected', 1)
    expect(r2).toHaveProperty('rows_affected', 1)
})

test('select', async () => {
    expect(await client.query('select name,balance from account'))
        .toEqual([{ name: 'foo', balance: 9 }, { name: 'bar', balance: 11 }])

    expect(await client.query('select name,balance from account where name = "ada"'))
        .toEqual([])

    expect(await client.query('select 1 as a'))
        .toEqual([{ a: 1 }])
})

test('deletion', async () => {
    expect(await client.exec('delete from account')).toHaveProperty('rows_affected', 2)
})

test('err', async () => {
    await expect(client.exec('delete from acc')).rejects.toEqual(new QueryError('no such table: acc'))
    await expect(client.query('select * from acc')).rejects.toEqual(new QueryError('no such table: acc'))
})
