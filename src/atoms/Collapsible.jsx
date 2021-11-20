import React, { useRef, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';

export const Collapsible = ({ open, children, ...props }) => {
    const ref = useRef();
    const [{ height }, setSpring] = useSpring(() => ({ height: 0, immediate: true }));
    useEffect(() => {
        if (open) ref.current.style.height = 'auto'; // QUESTION: only animate on open change?
        const height = open ? ref.current.scrollHeight : 0;
        setSpring.start({ height });
    }, [children, open]);
    return <animated.div ref={ref} style={{ height, overflow: 'hidden' }} {...props}>{children}</animated.div>;
};
