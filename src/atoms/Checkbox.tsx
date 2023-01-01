import { KeyboardEvent, HTMLAttributes } from 'react';
import { css, Theme } from '@emotion/react';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';

interface CheckboxProps extends HTMLAttributes<HTMLDivElement> {
    checked: boolean,
    value?: any,
    onChange?: (value: any) => void
};

const checkboxStyles = (theme: Theme) => css({
    cursor: 'pointer',
    '&>span': { color: theme.muted, margin: 2 },
    '&:focus': { outline: 'none' },
    '&:focus>span': { color: theme.text }
});

export const Checkbox = ({ checked = false, value, onChange, children, ...props }: CheckboxProps) => {
    const propsBase = {
        ...props, tabIndex: 0, css: checkboxStyles,
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            const { defaultPrevented, key } = event;
            if (defaultPrevented) return;
            if (key === ' ' || key === 'Spacebar') onChange && onChange(value ?? !checked);
        },
        onClick: () => {
            onChange && onChange(value ?? !checked);
        }
    };
    return <div {...propsBase}>
        {checked ? <FiCheckSquare /> : <FiSquare />}
        <span>{children}</span>
    </div>;
};
