import { useState, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { css, Theme } from '@emotion/react';
import { margin } from 'polished';
import { useListen } from './apis/uses';

const barStyles = (theme: Theme) => css({
    height: 3, ...margin(-2, 0), backgroundColor: theme.muted, borderRadius: 2
});

export const Bar = () => {
    const [progress, setProgress] = useState<{ [key: string]: number[] } | undefined>();
    const [{ percent, opacity }, setSpring] = useSpring(() => ({
        percent: 0, opacity: 0, immediate: true,
        onRest: {
            opacity: ({ value }) => value === 0 && setProgress(undefined) // reset progress on finish
        }
    }), []);
    useEffect(() => {
        const [count, total] = Object.values(progress ?? {}).reduce(
            ([sumCount, sumTotal], [count = 0, total = 100]) => ([sumCount + count, sumTotal + total]), [0, 0]);
        setSpring.start({ percent: count / (total || 1) * 100, opacity: count === total ? 0 : 1 });
    }, [progress]);

    useListen('progress', ({ resource, count, total }) => setProgress(progress => ({ ...progress, [resource]: [count, total] })));
    return <animated.div css={barStyles} style={{ width: percent.to(p => `${p}%`), opacity }}></animated.div>
}
