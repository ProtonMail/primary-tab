import createPrimaryListener from '../src/index'

const generateUid = () => Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1)

const set = ({ div, innerHTML, background, title, text }) => {
    console.log(text)
    div.innerHTML = innerHTML
    div.style.background = background
    document.title = title
}

const setPrimary = (div) => {
    set({
        div,
        text: 'I am primary!',
        background: 'green',
        innerHTML: 'I am the primary',
        title: 'Set to primary'
    })
}

const setSecondary = (div) => {
    set({
        div,
        text: 'I am secondary',
        background: 'red',
        innerHTML: 'I am the secondary',
        title: 'Set to secondary'
    })
}

const setInactive = (div) => {
    set({
        div,
        text: 'Set to inactive',
        background: '#eee',
        innerHTML: 'I am inactive',
        title: 'Set to inactive'
    })
}

const init = async () => {
    const sessionStorageKey = 'MSID'

    const windowId = (sessionStorageKey) => {
        const previousId = sessionStorage.getItem(sessionStorageKey)
        if (previousId) {
            return previousId
        }
        const newId = generateUid()
        sessionStorage.setItem(sessionStorageKey, newId)
        return newId
    }

    const inIframe = window != window.top

    const { addListener, removeListener, initialValue, destroy } = await createPrimaryListener({
        expiry: 5000,
        id: !inIframe ? windowId(sessionStorageKey) : undefined
    })

    document.body.innerHTML = `
        <div id="result"></div>
        <button id="stop">Destroy</button>
    `
    const resultDiv = document.body.querySelector('#result')
    const stopButton = document.body.querySelector('#stop')

    initialValue ? setPrimary(resultDiv) : setSecondary(resultDiv)

    const primarySecondaryListener = (isPrimary) => {
        if (isPrimary) {
            setPrimary(resultDiv)
        } else {
            setSecondary(resultDiv)
        }
    }

    addListener(primarySecondaryListener)

    stopButton.addEventListener('click', () => {
        removeListener(primarySecondaryListener)
        destroy()
        setInactive(resultDiv)
    })
}

document.addEventListener('DOMContentLoaded', init)
