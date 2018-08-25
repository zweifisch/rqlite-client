import { Lock } from './lock'

function sleep(time: number): Promise<null> {
    return new Promise(resolve => setTimeout(resolve, time))
}

test('lock', async () => {
    let seq = []
    let lock = new Lock()
    lock.acquire().then(x => setTimeout(() => seq.push(1) && lock.release(), 100))
    lock.acquire().then(x => setTimeout(() => seq.push(2) && lock.release(), 10))
    await lock.acquire()
    seq.push(3)
    lock.release()
    await lock.with(async () => {
        await sleep(100)
        seq.push(4)
    })
    await lock.with(async () => {
        seq.push(5)
    })
    expect(seq).toEqual([1, 2, 3, 4, 5])
})
