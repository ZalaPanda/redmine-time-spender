import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { createUseStyles } from 'react-jss';
import { FiTrash2, FiDroplet, FiSquare, FiCheckSquare } from 'react-icons/fi';

const useStyles = createUseStyles(theme => ({
    base: {
        display: 'flex', alignItems: 'center',
        '&>button': { padding: 0 },
        '&>input': { flexGrow: 1, textOverflow: 'ellipsis', padding: 0, margin: 0 },
        '&>svg': { display: 'none' },
        '&:hover>svg': { display: 'unset' }
    }
}));

const colors = ['red', 'green', 'yellow'];

export const Task = ({ task: { color, value: current, created_on, updated_on, closed_on }, onChange, onDelete }) => {
    const classes = useStyles();
    const [value, setValue] = useState(current);
    const nextColor = useMemo(() => colors[colors.indexOf(color) + 1], [color]);
    const propsBase = ({
        className: classes.base,
        title: `Created ${dayjs().to(created_on, true)} ago\nUpdated ${dayjs().to(updated_on, true)} ago`,
    });
    return <div {...propsBase}>
        <button style={{ color }}>{closed_on ?
            <FiCheckSquare onClick={() => onChange({ closed_on: undefined })} /> :
            <FiSquare onClick={() => onChange({ closed_on: dayjs().toJSON() })} />}
        </button>
        <input readOnly={!!closed_on} style={{ textDecoration: closed_on ? 'line-through' : 'none' }}
            value={value || ''} onChange={(event) => setValue(event.target.value)} onBlur={(event) => onChange({ value: event.target.value })} />
        {closed_on ?
            <FiTrash2 onClick={() => onDelete()} /> :
            <FiDroplet color={nextColor} onClick={() => onChange({ color: nextColor })} />}
    </div>
};