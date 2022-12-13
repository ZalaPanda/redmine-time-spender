import { FiCheckSquare, FiSquare } from 'react-icons/fi';

export const Checkbox = ({ checked = false, value = undefined, onChange = (_value: any) => { }, children, ...props }) => {
    const propsBase = {
        ...props, tabIndex: 0,
        onClick: () => onChange(value ?? !checked)
    };
    return <div {...propsBase}>{checked ? <FiCheckSquare /> : <FiSquare />}{children}</div>;
};
