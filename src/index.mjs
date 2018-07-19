/**
 * Idea:
 *  Elect a primary window with the help of the transactional guarantees in IndexedDB.
 *
 * Terminology:
 *  WID: Unique window ID. Recommended to persist in sessionStorage to survive through page refreshes.
 *  MID: Current primary window ID persisted in Indexed DB.
 *
 * tryPrimary(oldId):
 *  Get read-write transaction
 *  MID <- The Primary ID from Indexed DB
 *  expires <- When the primary expires
 *  If expires <= NOW || MID === oldId || MID === WID || MID === undefined
 *      Write WID and new expires to indexed db
 *      Release transaction
 *      WID is the primary
 *  Else
 *      Release transaction
 *      MID is the primary and WID is the secondary
 *
 * on init:
 *  WID <- read from sessionStorage, or generate WID and set it in sessionStorage.
 *  tryPrimary()
 *
 * on every 30 seconds
 *  tryPrimary()
 *
 * on before unload:
 *  (Can't write to IndexedDB because it's not guaranteed to write.)
 *  Write WID to localStorage, to trigger onStorage in other windows.
 *
 * on storage event:
 *  oldId <- value from storage event
 *  tryPrimary(oldId)
 */

const generateUid = () => Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1)

const initDb = ({ dbName, objectStoreName }) => new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, 1)
    openRequest.onupgradeneeded = () => {
        const db = openRequest.result
        db.createObjectStore(objectStoreName)
    }
    openRequest.onsuccess = () => resolve(openRequest.result)
    openRequest.onerror = () => reject(openRequest.error)
})

const tryPrimary = (db, name, objectStoreName, expiry, id, deadId) => {
    const tx = db.transaction(objectStoreName, 'readwrite')
    const store = tx.objectStore(objectStoreName)

    return new Promise((resolve, reject) => {
        const metaRequest = store.get(name)

        metaRequest.onsuccess = () => {
            const lockMeta = metaRequest.result

            if (lockMeta && (lockMeta.expires > Date.now() && lockMeta.id !== id && lockMeta.id !== deadId)) {
                resolve(false)
                return
            }

            const newLockMeta = { expires: expiry + Date.now(), id }
            const writeRequest = store.put(newLockMeta, name)

            writeRequest.onsuccess = () => resolve(true)
            writeRequest.onerror = () => reject(writeRequest.error)
        }

        metaRequest.onerror = () => reject(metaRequest.error)
    })
}

/**
 * Create a primary-tab listener.
 * @param {String} [id] - The id of this window.
 * @param {String} [objectStoreName='primary'] The name of the IndexedDB store.
 * @param {String} [dbName='primary'] The name of the IndexedDB database.
 * @param {String} [keyName='primary'] - The name of the key in the IndexedDB store.
 * @param {Number} [expiry=10000] - Max time in ms before the primary tab will expire. Note: The function can't take longer than this.
 * @param {String} [localStorageKey='MSID'] - The local storage key name for which to notify the other tabs.
 * @returns {Promise<{attempt: attempt, addListener: addListener, removeListener: removeListener, destroy: destroy, poll: poll}>}
 */
export default ({ id = generateUid(), objectStoreName = 'locks', keyName = 'primary', dbName = 'primary', expiry = 30000, localStorageKey = 'MSID' } = {}) => {
    let callbacks = []
    let cachedValue
    let intervalId
    let destroyed

    /**
     * Notify all the callbacks of the result.
     * @param result
     */
    const notify = (result) => callbacks.forEach((cb) => cb(result))

    /**
     * Attempt to get the lock
     * @param [oldId] - The ID of an old primary.
     * @returns {Promise}
     */
    const attempt = async (oldId) => {
        if (destroyed) {
            return
        }

        const db = await initDb({ dbName, objectStoreName })
        const result = await tryPrimary(db, keyName, objectStoreName, expiry, id, oldId)
        db.close()

        if (result === cachedValue) {
            return result
        }
        cachedValue = result
        notify(result)

        intervalId && window.clearInterval(intervalId)

        if (!result) {
            // Timer to re-attempt the lock. (In case the other primary is weirdly shut down).
            intervalId = window.setInterval(attempt, expiry)
        } else {
            // Timer to re-attempt the lock. Be somewhat eager to keep the primary in this window - refresh the primary expiration time
            const timeBeforeExpiration = expiry - ~~(expiry / 4)
            intervalId = window.setInterval(attempt, timeBeforeExpiration)
        }

        return result
    }

    /**
     * Clean the master if it is the current ID.
     * @returns {Promise}
     */
    const cleanMaster = async () => {
        const db = await initDb({ dbName, objectStoreName })
        await tryPrimary(db, keyName, objectStoreName, -Date.now(), id, id)
        db.close()
    }

    /**
     * Destroy the listener. Primarily used on the beforeunload event.
     * When this happens, write the id to localStorage to trigger the onStorage event
     * on the other windows, notifying that this ID has expired. Doing this because
     * IndexedDB is not guaranteed to write on beforeunload.
     * @param {Boolean} removeMaster If this WID is the current master, remove it
     */
    const destroy = (removeMaster = false) => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('beforeunload', onBeforeUnload)
        intervalId && window.clearInterval(intervalId)
        localStorage.setItem(localStorageKey, id)
        callbacks = []
        destroyed = true
        removeMaster && cleanMaster()
    }

    /**
     * Triggered for the storage event.
     * @param event
     * @returns {Promise}
     */
    const onStorage = async (event) => {
        const { key, newValue: oldId } = event
        if (key !== localStorageKey || !oldId || !oldId.length) {
            return
        }
        attempt(oldId)
    }

    /**
     * Triggered for the onbefore unload event.
     * Don't try to remove the current primary because it's not guaranteed to write.
     */
    const onBeforeUnload = () => {
        destroy(false)
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('beforeunload', onBeforeUnload)

    return {
        attempt,
        poll: () => cachedValue,
        /**
         * Add a listener for primary/secondary changes.
         * @param {Function} cb
         */
        addListener: (cb) => {
            callbacks.push(cb)
        },
        /**
         * Remove a listener.
         * @param {Function} cb
         */
        removeListener: (cb) => {
            callbacks = callbacks.filter((x) => x !== cb)
        },
        /**
         * Destroy this listener.
         * @param {Boolean} removeMaster If this WID is the current master, remove it
         */
        destroy
    }
}

