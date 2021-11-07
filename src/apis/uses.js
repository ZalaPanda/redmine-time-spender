import { useEffect } from 'react';

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
