import React from 'react';
import { FiCheckCircle, FiCircle } from 'react-icons/fi';

export const Checkbox = ({ checked, value, onChange = value => { }, children, ...props }) => {
    const propsBase = {
        ...props, tabIndex: 0,
        onClick: () => onChange(value || !checked)
    };
    return <label {...propsBase}>{checked ? <FiCheckCircle /> : <FiCircle />}{children}</label>
};
