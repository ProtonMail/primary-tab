# primary-tab

This library provides primary-secondary window functionality for the browser. It synchronizes which window becomes a master through the transactional guarantees of IndexedDB. The general idea of the process is described in src/index.js

The library requires the the support of Promises, async/await, modules, IndexedDB, and localStorage.

## Browser support
Chrome, Safari, Firefox, Edge, IE11

## Usage

```javascript
import createPrimaryListener from 'primary-tab'

const setPrimary = () => console.log('I am the primary')
const setSecondary = () => console.log('I am the secondary')

const options = { expiry: 5000 }
const { addListener, removeListener, initialValue, destroy } = await createPrimaryListener(options);

initialValue ? setPrimary() : setSecondary();

const primarySecondaryListener = (isMaster) => {
    console.log('Primary/secondary change');
    if (isMaster) {
        setPrimary();
    } else {
        setSecondary();
    }
};

addListener(primarySecondaryListener);

// Cleanup
removeListener(primarySecondaryListener);

destroy();
```

## Default Options

```javascript
{
    id: 'random-uid' // The id of this window. Must be unique.
    objectStoreName: 'primary' // The name of the IndexedDB store.
    dbName: 'primary' // The name of the IndexedDB database.
    keyName 'primary' // The name of the key in the IndexedDB store.
    expiry: 10000 // Max time in ms before the primary tab will expire. Note: The current primary window is given priority to continue as primary window after the expiration.
    localStorageKey: 'MSID' // The local storage key name for which to notify the other tabs.
}
```

## Example

Example available in the example/ folder

## Author

Mattias Svanström (@mmso) - ProtonMail
