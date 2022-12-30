import { useState, HTMLAttributes } from 'react';
import { css, Theme } from '@emotion/react';
import { padding } from 'polished';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import { FiMinimize2, FiMaximize2 } from 'react-icons/fi';
import { useAsyncEffect, useRaise } from './apis/uses';

const dialogStyles = (theme: Theme) => css({
    position: 'fixed', zIndex: 1, width: 420, margin: 8, padding: 8,
    backgroundColor: theme.bg, borderWidth: 1, borderStyle: 'solid', borderColor: theme.border, boxShadow: `0 3px 9px ${theme.shadow}`,
    '&>div': { maxHeight: 400, overflowX: 'hidden', overflowY: 'auto' }
});
const titleStyles = (theme: Theme) => css({
    display: 'flex', alignItems: 'center', ...padding(0, 10), backgroundColor: theme.title.bg, color: theme.title.text, fontWeight: 'bold',
    userSelect: 'none', touchAction: 'none', cursor: 'grab',
    '&:active': { cursor: 'grabbing' },
});

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
    show: any,
    title: string,
    onShow?: () => void
};

export const Dialog = ({ show, title, children, onShow, ...props }: DialogProps) => {
    const [minimized, setMinimized] = useState(false);
    const raiseHideSelect = useRaise('hide-select'); // NOTE: check Select.tsx:184
    const [{ y, scale }, setSpring] = useSpring(() => ({ y: -400, scale: 1, immediate: true, config: config.stiff }), []);

    const propsTitle = {
        css: titleStyles,
        ...useDrag(({ down, offset: [_, y] }) => setSpring.start({ y, scale: down ? 1.05 : 1 }), { delay: true, from: () => [0, y.get()] })()
    };
    const propsContent = {
        hidden: minimized,
        onScroll: () => raiseHideSelect()
    };
    const propsMinimize = {
        title: minimized ? 'Maximize' : 'Minimize', onClick: () => setMinimized(minimized => !minimized)
    };

    useAsyncEffect(async ({ aborted }) => { // animation and autofocus on entry change
        await Promise.all(setSpring.start({ y: -400 }));
        if (aborted) return;
        if (!show) return;
        await Promise.all(setSpring.start({ y: 0 }));
        onShow && onShow();
    }, [show]);
    return <animated.div css={dialogStyles} style={{ y, scale }} {...props}>
        <div {...propsTitle}>
            <label>{title}</label>
            <button {...propsMinimize}>{minimized ? <FiMinimize2 /> : <FiMaximize2 />}</button>
        </div>
        <div {...propsContent}>{children}</div>
    </animated.div>;
};
