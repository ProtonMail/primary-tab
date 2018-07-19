import createPrimarySecondaryListener from '../src/index'

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time))

const clearDb = (dbName, tableName) => {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = (event) => {
            const db = event.target.result
            const tx = db.transaction(tableName, 'readwrite')
            tx.objectStore(tableName).clear()
            tx.oncomplete = () => resolve()
        }
    })
}

describe('primary secondary listener', () => {
    afterEach(() => {
        return clearDb('primary', 'locks')
    })

    it('elects a primary and sets a primary value', async () => {
        const { attempt, destroy } = createPrimarySecondaryListener()

        expect(await attempt()).toBeTruthy()

        destroy()
    })

    it('elects a primary and sets a secondary value', async () => {
        const { attempt, destroy } = createPrimarySecondaryListener()
        const { attempt: attemptSecondary, destroy: destroySecondary } = createPrimarySecondaryListener()

        expect(await attempt()).toBeTruthy()
        // Needed since IDB transactions can be randomized apparently.
        await delay(50)
        expect(await attemptSecondary()).toBeFalsy()

        destroy()
        destroySecondary()
    })

    it('elects a primary and can keep primary', async () => {
        const { attempt, destroy, poll } = createPrimarySecondaryListener({ expiry: 100 })
        const { attempt: attemptSecondary, destroy: destroySecondary, poll: pollSecondary } = createPrimarySecondaryListener({ expiry: 100 })

        expect(await attempt()).toBeTruthy()
        await delay(50)
        expect(await attemptSecondary()).toBeFalsy()

        for (let i = 0; i < 10; ++i) {
            await delay(50)
            expect(poll()).toBeTruthy()
            expect(pollSecondary()).toBeFalsy()
        }

        destroy()
        destroySecondary()
    })

    it('elects a primary and can change primary', async (done) => {
        const { attempt, destroy } = createPrimarySecondaryListener({ expiry: 100 })
        const { attempt: attemptSecondary, addListener: addListenerSecondary, destroy: destroySecondary } = createPrimarySecondaryListener({ expiry: 100 })

        expect(await attempt()).toBeTruthy()
        await delay(50)
        expect(await attemptSecondary()).toBeFalsy()

        addListenerSecondary(async (value) => {
            expect(value).toBeTruthy()

            destroySecondary()

            done()
        })

        destroy()
    })

    it('elects a primary with multiple', async () => {
        const { attempt, poll, destroy } = createPrimarySecondaryListener({ expiry: 100 })

        expect(await attempt()).toBeTruthy()
        await delay(50)

        const createTest = async () => {
            const { attempt, poll, destroy } = createPrimarySecondaryListener({ expiry: 100 })
            expect(await attempt()).toBeFalsy()
            for (let i = 0; i < 10; ++i) {
                await delay(Math.random() * 100)
                expect(poll()).toBeFalsy()
            }
            destroy()
        }

        await Promise.all((Array.apply(null, Array(20))).map(createTest))

        expect(poll()).toBeTruthy()

        destroy()
    })
})
