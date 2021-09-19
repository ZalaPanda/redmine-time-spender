import Dexie from 'dexie';
export const database = new Dexie('redmine-cache');
database.version(1).stores({
    projects: '++, &id, updated_on',
    issues: '&id, updated_on',
    activities: '&id',
    entries: '&id, spent_on, updated_on', // order: updated_on <desc>
    tasks: '++id',
    logs: '++'
});
database.open();
export const log = (...data) => database.logs.add([new Date().toJSON(), ...data]) || console.log(...data);
export const settings = {
    get: (keys) => new Promise((resolve, reject) => chrome.storage.local.get(keys, (items) => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(items))),
    set: (items) => new Promise((resolve, reject) => chrome.storage.local.set(items, () => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()))
};