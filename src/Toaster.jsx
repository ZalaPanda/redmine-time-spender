import React, { useState, useEffect } from 'react';
import { createUseStyles } from 'react-jss';
import { FiX } from 'react-icons/fi';
import { useTransition, animated, config } from '@react-spring/web';
import { useListen } from './uses.js';

const useStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    toaster: {
        position: 'fixed', zIndex: 1, width: 420, height: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        '&>div': {
            display: 'inline-flex', flexDirection: 'row', alignItems: 'center',
            flexShrink: 0, margin: 1, padding: [4, 10], borderRadius: 6, boxShadow: [0, 3, 9, theme.shadow],
            '&>label': { whiteSpace: 'pre' },
            '&>svg': { flexShrink: 0, cursor: 'pointer' }
        }
    },
    error: { color: theme.text, backgroundColor: theme.danger }
}));

const Toast = ({ message, onDismiss = () => { }, ...props }) => {
    useEffect(() => {
        const timeout = setTimeout(onDismiss, 10 * 1000); // auto-close after 10s
        return () => clearTimeout(timeout);
    }, []);
    const propsDismiss = { onClick: onDismiss };
    return <animated.div {...props}>
        <label>{message}</label><FiX {...propsDismiss} />
    </animated.div>;
}

export const Toaster = () => {
    const classes = useStyles();
    const [items, setItems] = useState([]);
    const transitions = useTransition(items, {
        from: { transform: 'translate(0,-80px)', opacity: 0 },
        enter: { transform: 'translate(0,0px)', opacity: 1 },
        leave: { transform: 'translate(0,-80px)', opacity: 0 },
        config: config.stiff
    });
    const propsToast = (style, { key, ...props }) => ({
        key, style, ...props,
        onDismiss: () => setItems(items => items.filter(item => item.key !== key))
    });
    useListen('error', (error) => setItems(items => [...items, {
        key: Date.now(), message: error?.message || String(error), className: classes.error
    }]));
    return <div className={classes.toaster}>
        {transitions((style, item) => <Toast {...propsToast(style, item)} />)}
    </div>;
};