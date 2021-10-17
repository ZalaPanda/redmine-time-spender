import React from 'react';
import { FiCheckSquare, FiSquare } from 'react-icons/fi';

export const Checkbox = ({ checked, value, onChange = value => { }, children, ...props }) => {
    const propsBase = {
        ...props, tabIndex: 0,
        onClick: () => onChange(value ?? !checked)
    };
    return <label {...propsBase}>{checked ? <FiCheckSquare /> : <FiSquare />}{children}</label>
};
