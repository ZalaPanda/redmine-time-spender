import { useState } from 'react';
import { css, Theme } from '@emotion/react';
import { margin, padding } from 'polished';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import { FiMinimize2, FiMaximize2 } from 'react-icons/fi';
import { useAsyncEffect } from './apis/uses';

const dialogStyles = (theme: Theme) => css({
    position: 'fixed', zIndex: 1, width: 420, margin: 8, padding: 8,
    backgroundColor: theme.bg, borderWidth: 1, borderStyle: 'solid', borderColor: theme.border, boxShadow: `0 3px 9px ${theme.shadow}`
});
const titleStyles = (theme: Theme) => css({
    display: 'flex', alignItems: 'center', ...padding(0, 10), backgroundColor: theme.title.bg, color: theme.title.text, fontWeight: 'bold',
    userSelect: 'none', touchAction: 'none', cursor: 'grab',
    '&:active': { cursor: 'grabbing' },
});
const fieldsStyles = (theme: Theme) => css({
    '&>div': {
        display: 'flex', alignItems: 'center', padding: 2,
        '&>label': { color: theme.field.text }, // label with svg icon
        '&>div, &>input': { flexGrow: 1 }, // project, issue, activity
        '&>textarea': { color: theme.muted, flexGrow: 1 } // comments
    },
    '&>div:focus-within': {
        '&>label': { color: theme.field.focus }, // label with svg icon
    },
    '&>hr': { ...margin(0, 10, 0, 30), border: 0, borderBottom: 1, borderStyle: 'solid', borderColor: theme.border }
});

export const Dialog = ({ show, title, children, ...props }) => {
    const [minimized, setMinimized] = useState(false);
    const [{ y, scale }, setSpring] = useSpring(() => ({ y: -400, scale: 1, immediate: true, config: config.stiff }));

    const propsTitle = {
        ...useDrag(({ down, offset: [_, y] }) => setSpring.start({ y, scale: down ? 1.05 : 1 }), { delay: true, from: () => [0, y.get()] })()
    };
    const propsMinimize = {
        title: minimized ? 'Maximize' : 'Minimize', onClick: () => setMinimized(minimized => !minimized)
    };

    useAsyncEffect(async ({ aborted }) => { // animation and autofocus on entry change
        await Promise.all(setSpring.start({ y: -400 }));
        if (aborted) return;
        if (!show) return;
        await Promise.all(setSpring.start({ y: 0 }));
    }, [show]);
    return <animated.div css={dialogStyles} style={{ y, scale }} {...props}>
        <div css={titleStyles} {...propsTitle}>
            <label>{title}</label>
            <button {...propsMinimize}>{minimized ? <FiMinimize2 /> : <FiMaximize2 />}</button>
        </div>
        <div hidden={minimized} css={fieldsStyles}>{children}</div>
    </animated.div>;
};
