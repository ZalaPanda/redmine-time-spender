import { useState, useEffect, HTMLAttributes } from 'react';
import { css, Theme } from '@emotion/react';
import { padding } from 'polished';
import { FiX } from 'react-icons/fi';
import { useTransition, animated, config } from '@react-spring/web';
import { useListen } from './apis/uses';

const toasterStyles = (theme: Theme) => css({
    position: 'fixed', zIndex: 1, width: 420, height: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    '&>div': {
        display: 'inline-flex', flexDirection: 'row', alignItems: 'center',
        flexShrink: 0, margin: 1, ...padding(4, 10), borderRadius: 6, boxShadow: `0 3px 9px ${theme.shadow}`,
        '&>label': { whiteSpace: 'pre' },
        '&>svg': { flexShrink: 0, cursor: 'pointer' }
    }
});
const noticeStyles = (theme: Theme) => css({
    backgroundColor: theme.badge.bg, color: theme.badge.text
});
const errorStyles = (theme: Theme) => css({
    backgroundColor: theme.danger, color: theme.text
});

interface ToastProps extends HTMLAttributes<HTMLDivElement> {
    message?: JSX.Element,
    interval?: number,
    onDismiss?: () => void
};

const Toast = ({ message = null, interval = 10 * 1000, onDismiss, ...props }: ToastProps) => {
    useEffect(() => {
        const timeout = setTimeout(onDismiss, interval); // auto-close
        return () => clearTimeout(timeout);
    }, []);
    const propsDismiss = { onClick: onDismiss };
    return <animated.div {...props}>
        <label>{message}</label><FiX {...propsDismiss} />
    </animated.div>;
}

export const Toaster = () => {
    const [items, setItems] = useState([]);
    const transitions = useTransition(items, {
        from: { transform: 'translate(0,-80px)', opacity: 0 },
        enter: { transform: 'translate(0,0px)', opacity: 1 },
        leave: { transform: 'translate(0,-80px)', opacity: 0 },
        config: config.stiff
    });
    const propsToast = (style: {}, { key, ...props }) => ({
        key, style, ...props,
        onDismiss: () => setItems(items => items.filter(item => item.key !== key))
    });
    useListen('notice', (notice) => setItems(items => [...items, {
        key: Date.now(), message: notice, interval: 3000, css: noticeStyles
    }]));
    useListen('error', (error) => setItems(items => [...items, {
        key: Date.now(), message: error?.message || String(error), interval: 10000, css: errorStyles
    }]));
    return <div css={toasterStyles}>
        {transitions((style, item) => <Toast {...propsToast(style, item)} />)}
    </div>;
};