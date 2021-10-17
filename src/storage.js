import { useEffect, createContext, useContext } from 'react';

export const storage = {
    get: (keys) => new Promise((resolve, reject) => chrome.storage.local.get(keys, (items) => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(items))),
    set: (items) => new Promise((resolve, reject) => chrome.storage.local.set(items, () => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()))
};

const SettingsContext = createContext();
export const SettingsProvider = SettingsContext.Provider;
export const useSettings = () => useContext(SettingsContext);

export const useRaise = (type) => (detail) => window.dispatchEvent(new CustomEvent(type, { detail }));
export const useListen = (type, callback = (_detail) => { }) => useEffect(() => {
    const listener = (event) => callback(event.detail);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
}, [callback]);
export const useAsyncEffect = (effect = async (_signal) => { }, deps = undefined) => useEffect(() => { // NOTE: cleaning not used/implemented
    const controller = new AbortController();
    effect && effect(controller.signal);
    return () => controller.abort();
}, deps);
