# rqlite-client

nodejs client for [rqlite](https://github.com/rqlite/rqlite), with cluster support

```js
const { Client } = require('rqlite-client')

const client = new Client(['http://localhost:4001', 'http://localhost:4003'])

async function main() {

    await client.exec(`\
CREATE TABLE IF NOT EXISTS account (
  id integer not null primary key,
  name text,
  balance integer not null default 0)`)

    await client.exec('INSERT INTO account(name, balance) VALUES("foo", 10)')
    await client.exec('INSERT INTO account(name, balance) VALUES("bar", 10)')

    await client.batch([
        'UPDATE ACCOUNT SET balance = balance - 1 WHERE name = "foo"',
        'UPDATE ACCOUNT SET balance = balance + 1 WHERE name = "bar"',
    ], true) // true for atomic

    await client.query('SELECT * FROM account')
}
```
