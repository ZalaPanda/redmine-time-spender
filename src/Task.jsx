import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { createUseStyles } from 'react-jss';
import { FiTrash2, FiDroplet, FiSquare, FiCheckSquare } from 'react-icons/fi';

const useStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    base: {
        display: 'flex', alignItems: 'center',
        '&>button': { padding: 0 },
        '&>input': { flexGrow: 1, textOverflow: 'ellipsis', padding: 0, margin: 0 },
        '&>svg': { display: 'none' },
        '&:hover>svg': { display: 'unset' }
    }
}));

const colors = ['red', 'green', 'gray'];

export const Task = ({ task: { color, value: current, created_on, updated_on, closed_on }, onChange, onDelete }) => {
    const classes = useStyles();

    const nextColor = useMemo(() => colors[colors.indexOf(color) + 1], [color]);
    const title = useMemo(() => [
        created_on && ['Created', dayjs(created_on)],
        updated_on && ['Updated', dayjs(updated_on)],
        closed_on && ['Closed', dayjs(closed_on)]
    ].filter(on => on).map(([text, date]) => `${text} ${date.fromNow()} at ${date.format('HH:mm')}`).join('\n'), [created_on, updated_on, closed_on]);

    const [value, setValue] = useState(current);

    const propsBase = ({
        className: classes.base, title
    });
    const propsInput = ({
        value: value || '', readOnly: !!closed_on,
        style: { textDecoration: closed_on ? 'line-through' : 'none' },
        onChange: event => setValue(event.target.value),
        onKeyDown: event => value === current || event.which === 13 && onChange({ updated_on: dayjs().toJSON(), value }), // save changes
        onBlur: _ => value === current || onChange({ updated_on: dayjs().toJSON(), value }) // save changes
    });
    const propsToggle = ({
        style: { color },
        onClick: () => onChange({ closed_on: closed_on ? undefined : dayjs().toJSON() })
    });
    const propsColor = ({
        color: nextColor,
        onClick: () => onChange({ updated_on: dayjs().toJSON(), color: nextColor })
    });
    const propsDelete = ({
        onClick: () => onDelete()
    });
    return <div {...propsBase}>
        <button {...propsToggle}>{closed_on ? <FiCheckSquare /> : <FiSquare />}</button>
        <input {...propsInput} />
        {closed_on ? <FiTrash2 {...propsDelete} /> : <FiDroplet {...propsColor} />}
    </div>
};