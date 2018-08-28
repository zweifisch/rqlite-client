import fetch from 'node-fetch'
import { Lock } from './lock'
import debug from 'debug'

const log = debug('rqlite')

export class QueryError extends Error {
    constructor(public message: string) {
        super(message)
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

interface ExecError {
    error: string
}

interface ExecResult {
    last_insert_id: number
    rows_affected: number
}

interface QueryResult {
    columns: Array<string>
    types: Array<string>
    values: Array<any>
}

interface Response<T> {
    results: Array<T>
}

const redirection = new Set([301, 302, 307])

function zipmap(keys: Array<string>, values: Array<any>): any {
    let ret = {}
    for (let i = 0; i < keys.length; i++) {
        ret[keys[i]] = values[i]
    }
    return ret
}

function retry(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    let method = descriptor.value
    descriptor.value = async function(...args) {
        try {
            return await method.apply(this, args)
        } catch (err) {
            if (err.code === 'ECONNREFUSED') {
                return await this.lock.with(async () => {
                    let retry = 0
                    while (retry < this.urls.length) {
                        retry += 1
                        log(`retry(${retry}) ${propertyKey}`)
                        if (retry > 1) {
                            // url might be changed by other query, try currently one first
                            this.nextServer()
                        }
                        try {
                            return await method.apply(this, args)
                        } catch (err) {
                            if (err.code !== 'ECONNREFUSED') {
                                throw err
                            }
                        }
                    }
                    throw Error('No server available')
                })
            }
            throw err
        }
    }
}

export class Client {
    private _url: string
    private urls: Array<string>
    private lock: Lock

    constructor(url: string);
    constructor(urls: Array<string>);
    constructor(urls: string | Array<string>) {
        this.urls = Array.isArray(urls) ? urls : [urls]
        this.url = this.urls[0]
        this.lock = new Lock
    }

    private set url(url) {
        log(`using server ${url}`)
        this._url = url
    }

    private get url(): string {
        return this._url
    }

    private nextServer() {
        let index = this.urls.indexOf(this.url)
        this.url = this.urls[(index + 1) % this.urls.length]
    }

    async exec(sql: string, url?: string): Promise<ExecResult> {
        let [result] = await this.batch([sql], false, url)
        if (result instanceof QueryError) {
            throw result
        }
        return result as ExecResult
    }

    @retry
    async query(sql: string): Promise<Array<any>> {
        let result = await fetch(`${this.url}/db/query?q=${encodeURIComponent(sql)}`)
        if (result.status >= 400) {
            throw Error(`${result.status} ${await result.text()}`)
        }
        let resp: Response<QueryResult | ExecError> = await result.json()
        if ('error' in resp.results[0]) {
            throw new QueryError((resp.results[0] as ExecError).error)
        }
        let { columns, values = [] } = resp.results[0] as QueryResult
        return values.map(x => zipmap(columns, x))
    }

    @retry
    async batch(sqls: Array<string>, atomic: boolean = true, url?: string): Promise<Array<QueryError | QueryResult | ExecResult>> {
        let result = await fetch(url ? url : `${this.url}/db/execute${atomic ? '?atomic' : ''}`, {
            method: 'POST',
            redirect: 'manual',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(sqls)
        })
        if (result.status >= 400) {
            throw Error(`${result.status} ${await result.text()}`)
        }
        if (redirection.has(result.status)) {
            return this.batch(sqls, atomic, result.headers.get('location'))
        }
        let resp: Response<ExecError | QueryResult | ExecResult> = await result.json()
        return resp.results.map(x => 'error' in x ? new QueryError(x.error) : x as QueryResult | ExecResult)
    }

    @retry
    async status(): Promise<any> {
        let result = await fetch(`${this.url}/status`)
        return await result.json()
    }
}
