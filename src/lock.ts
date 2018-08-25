export class Lock {
    private queue: Array<Function>
    private last: Promise<null>

    constructor() {
        this.queue = []
        this.last = Promise.resolve(null)
    }

    acquire() {
        const ret = this.last
        this.last = new Promise(resolve => this.queue.push(resolve))
        return ret
    }

    release() {
        if (this.queue.length) {
            this.queue.shift()()
        }
    }

    async with(task: Function) {
        await this.acquire()
        let ret
        try {
            ret = await task()
        } catch (err) {
            this.release()
            throw err
        }
        this.release()
        return ret
    }
}
