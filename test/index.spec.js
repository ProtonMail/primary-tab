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
        const { initialValue, destroy } = await createPrimarySecondaryListener()

        expect(initialValue).toBeTruthy()

        destroy()
    })

    it('elects a primary and sets a secondary value', async () => {
        const { initialValue, destroy } = await createPrimarySecondaryListener()
        // Needed since IDB can be randomized apparently.
        await delay(50)
        const { initialValue: secondaryValue, destroy: destroySecondary } = await createPrimarySecondaryListener()

        expect(initialValue).toBeTruthy()
        expect(secondaryValue).toBeFalsy()

        destroy()
        destroySecondary()
    })

    it('elects a primary and can keep primary', async () => {
        const { initialValue, destroy, poll } = await createPrimarySecondaryListener({ expiry: 100 })
        await delay(50)
        const { initialValue: secondaryValue, destroy: destroySecondary, poll: pollSecondary } = await createPrimarySecondaryListener({ expiry: 100 })

        expect(initialValue).toBeTruthy()
        expect(secondaryValue).toBeFalsy()

        for (let i = 0; i < 10; ++i) {
            await delay(50)
            expect(poll()).toBeTruthy()
            expect(pollSecondary()).toBeFalsy()
        }

        destroy()
        destroySecondary()
    })

    it('elects a primary and can change primary', async (done) => {
        const { initialValue, destroy } = await createPrimarySecondaryListener({ expiry: 100 })
        await delay(50)
        const { initialValue: secondaryValue, addListener: addListenerSecondary, destroy: destroySecondary } = await createPrimarySecondaryListener({ expiry: 100 })

        addListenerSecondary(async (value) => {
            expect(value).toBeTruthy()

            destroySecondary()

            done()
        })

        expect(initialValue).toBeTruthy()
        expect(secondaryValue).toBeFalsy()

        destroy()
    })

    it('elects a primary with multiple', async () => {
        const { initialValue, poll, destroy } = await createPrimarySecondaryListener({ expiry: 100 })

        expect(initialValue).toBeTruthy()
        await delay(50)

        const createTest = async () => {
            const { initialValue, poll, destroy } = await createPrimarySecondaryListener({ expiry: 100 })
            expect(initialValue).toBeFalsy()
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
