import React, { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { createUseStyles } from 'react-jss';
// import { useDrag } from 'react-use-gesture';
// import { useSpring, animated, config } from 'react-spring';
import { FiCircle, FiCheckCircle, FiFlag, FiTrash2 } from 'react-icons/fi';
import { Textarea } from './atoms/Textarea.jsx';

const useStyles = createUseStyles(theme => ({
    base: {
        display: 'flex', alignItems: 'center',
        '&>textarea': { flexGrow: 1, padding: 0, margin: 0 }
    }
}));

const colors = ['white', 'red', 'green', 'yellow'];

export const Task = ({ task: { id, color, value: current, created_on, updated_on, closed_on }, onChange, onDelete }) => {
    const classes = useStyles();
    const refs = useRef({ timeout: undefined });
    const [active, setActive] = useState(false);
    const [value, setValue] = useState(current);
    const propsBase = ({
        onBlur: () => refs.current.timeout = setTimeout(() => setActive(false), 100), // -> start hide timeout
        onFocus: () => clearTimeout(refs.current.timeout) || setActive(true), // -> cancel list hide timeout
        tabIndex: -1, // needed to detect focus/blur events
        className: classes.base,
        title: `Created ${dayjs().to(created_on, true)} ago\nUpdated ${dayjs().to(updated_on, true)} ago`,
        // ...props
    });
    return <div {...propsBase}>
        <label style={{ color }}>{closed_on ?
            <FiCheckCircle onClick={() => onChange({ closed_on: undefined })} /> :
            <FiCircle onClick={() => onChange({ closed_on: dayjs().toJSON() })} />}
        </label>
        <Textarea readOnly={!!closed_on} style={{ textDecoration: closed_on ? 'line-through' : 'none' }}
            value={value || ''} onChange={(event) => setValue(event.target.value)} onBlur={(event) => onChange({ value: event.target.value })} />
        {/* <label style={{ textDecoration: done ? 'line-through' : 'none' }}>{value}</label> */}
        {/* TODO: use hover! */}
        {/* {active && <>
            <FiFlag tabIndex={1} onClick={() => onChange({ color: colors[colors.indexOf(color) + 1] })} />
            <FiTrash2 tabIndex={1} onClick={() => onDelete()} />
        </>} */}
    </div>
};