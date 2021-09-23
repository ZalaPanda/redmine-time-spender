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

const colors = ['red', 'green', 'yellow']; // TODO: get colors from theme

export const Task = ({ task: { color, value: current, created_on, updated_on, closed_on }, onChange, onDelete }) => {
    const classes = useStyles();

    const nextColor = useMemo(() => colors[colors.indexOf(color) + 1], [color]);
    const title = [
        created_on && `Created ${dayjs().to(created_on, true)} ago`,
        updated_on && `Updated ${dayjs().to(updated_on, true)} ago`,
        closed_on && `Closed ${dayjs().to(closed_on, true)} ago`].filter(row => row).join('\n');

    const [value, setValue] = useState(current);

    const propsBase = ({
        className: classes.base, title
    });
    const propsInput = ({
        value: value || '', readOnly: !!closed_on,
        style: { textDecoration: closed_on ? 'line-through' : 'none' },
        onChange: (event) => setValue(event.target.value),
        onBlur: () => value === current || onChange({ value }) // save changes
    });
    const propsToggle = ({
        style: { color },
        onClick: () => onChange({ closed_on: closed_on ? undefined : dayjs().toJSON() })
    });
    const propsColor = ({
        color: nextColor,
        onClick: () => onChange({ color: nextColor })
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