import { useRef, useEffect, HTMLAttributes } from 'react';
import { useSpring, animated } from '@react-spring/web';

interface CollapsibleProps extends HTMLAttributes<HTMLDivElement> {
    open: boolean
};

export const Collapsible = ({ open, children, ...props }: CollapsibleProps) => {
    const element = useRef<HTMLDivElement>();
    const [{ height }, setSpring] = useSpring(() => ({ height: 0, immediate: true }));
    useEffect(() => {
        if (open) element.current.style.height = 'auto'; // QUESTION: only animate on open change?
        const height = open ? element.current.scrollHeight : 0;
        setSpring.start({ height });
    }, [children, open]);
    return <animated.div ref={element} style={{ height, overflow: 'hidden' }} {...props}>{children}</animated.div>;
};
