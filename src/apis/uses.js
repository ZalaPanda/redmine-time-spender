import { useEffect, useState, useRef } from 'react';

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
export const useTimeoutState = (initialState) => { // NOTE: not used anymore -> startTransition
    const handle = useRef();
    const [value, setInnerValue] = useState(initialState);
    const setValue = (value, ms = 0) => {
        clearTimeout(handle.current);
        handle.current = setTimeout(() => setInnerValue(value), ms);
    };
    return [value, setValue];
};