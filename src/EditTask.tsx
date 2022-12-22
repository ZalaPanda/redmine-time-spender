import { useState, useMemo, ChangeEvent, KeyboardEvent } from 'react';
import dayjs from 'dayjs';
import { css } from '@emotion/react';
import { FiTrash2, FiDroplet, FiSquare, FiCheckSquare } from 'react-icons/fi';

const taskStyles = css({
    display: 'flex', alignItems: 'center',
    '&>button': { padding: 0 },
    '&>input': { flexGrow: 1, textOverflow: 'ellipsis', padding: 0, margin: 0 },
    '&>svg': { display: 'none' },
    '&:hover>svg': { display: 'unset' }
});

type Color = 'red' | 'green' | 'gray';
const colors: Color[] = ['red', 'green', 'gray'];

export interface Task {
    id: number,
    color: Color,
    value: string,
    created_on: string,
    updated_on: string | undefined,
    closed_on: string | undefined
};

export interface TaskProps {
    task: Task,
    onChange: (updated: Partial<Task>) => void,
    onDelete: () => void
};

export const EditTask = ({ task: { color, value: current, created_on, updated_on, closed_on }, onChange, onDelete }: TaskProps) => {
    const nextColor = useMemo(() => colors[colors.indexOf(color) + 1], [color]);
    const title = useMemo(() => [
        created_on && ['Created', dayjs(created_on)],
        updated_on && ['Updated', dayjs(updated_on)],
        closed_on && ['Closed', dayjs(closed_on)]
    ].filter(Boolean).map(([text, date]: [string, dayjs.Dayjs]) => `${text} ${date.fromNow()} at ${date.format('HH:mm')}`).join('\n'), [created_on, updated_on, closed_on]);

    const [value, setValue] = useState(current);

    const propsBase = ({
        css: taskStyles, title
    });
    const propsInput = ({
        value: value || '', readOnly: !!closed_on,
        style: { textDecoration: closed_on ? 'line-through' : 'none' },
        onChange: (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => value === current || event.key === 'Enter' && onChange({ updated_on: dayjs().toJSON(), value }), // save changes
        onBlur: () => value === current || onChange({ updated_on: dayjs().toJSON(), value }) // save changes
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