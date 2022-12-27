import { HTMLAttributes } from 'react';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';

interface CheckboxProps extends HTMLAttributes<HTMLDivElement> {
    checked: boolean,
    value?: any,
    onChange?: (value: any) => void
};

export const Checkbox = ({ checked = false, value, onChange, children, ...props }: CheckboxProps) => {
    const propsBase = {
        ...props, tabIndex: 0,
        onClick: () => {
            onChange && onChange(value ?? !checked);
        }
    };
    return <div {...propsBase}>{checked ? <FiCheckSquare /> : <FiSquare />}{children}</div>;
};
