import { useEffect, useState, useRef } from 'react';

export const useRaise = (type: string) => (detail?: any) => window.dispatchEvent(new CustomEvent(type, { detail }));
export const useListen = (type: string, callback: (detail: any) => void) => useEffect(() => {
    const listener = (event: CustomEvent) => callback(event.detail);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
}, [callback]);
export const useAsyncEffect = (effect: (signal: AbortSignal) => Promise<void>, deps: React.DependencyList = undefined) => useEffect(() => { // NOTE: cleaning not used/implemented
    const controller = new AbortController();
    effect && effect(controller.signal);
    return () => controller.abort();
}, deps);
export const useTimeoutState = <T>(initialState: T) => { // NOTE: not used anymore -> startTransition
    const handle = useRef<NodeJS.Timeout>();
    const [value, setInnerValue] = useState(initialState);
    const setValue = (value: React.SetStateAction<T>, ms = 0) => {
        clearTimeout(handle.current);
        handle.current = setTimeout(() => setInnerValue(value), ms);
    };
    return [value, setValue];
};