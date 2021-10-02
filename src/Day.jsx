import React, { useMemo, useRef } from 'react';
import { useSpring, animated } from 'react-spring';
import { createUseStyles } from 'react-jss';
import dayjs from 'dayjs';
import { FiEdit } from 'react-icons/fi';
import { useAsyncEffect, useSettings } from './storage.js';

const useStyles = createUseStyles(theme => ({ // color codes: https://www.colorsandfonts.com/color-system
    base: {
        display: 'flex',
        '&>label': { width: 100 },
        '&>b': { width: 50 },
        '&>div': { flexGrow: 1 }
    },
    entry: { position: 'relative', margin: 2, border: '1px solid #333', padding: 8 },
    hours: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, float: 'left',
        '&>b, &>svg, &>button': { position: 'absolute', padding: 0, margin: 0 },
        '&>button': {
            width: 0, height: 36, border: 'none', borderRadius: 18, overflow: 'hidden',
            backgroundColor: theme.gray200, color: theme.font,
            '&:focus': { width: 36 },
            '&>svg': { fontSize: 20 },
        },
        '&:hover>button': { width: 36 }
    },
    activity: { backgroundColor: theme.gray100, borderRadius: 4, padding: [0, 4], float: 'right' },
    comments: { color: '#888' },
    bar: {
        position: 'relative', height: 12,
        '&>div': { position: 'absolute', display: 'flex', width: '100%', height: '100%' }
    },
    ellapsed: { backgroundColor: 'red', margin: [4, 0], boxSizing: 'border-box' },
    spent: { backgroundColor: 'green', border: [1, 'solid', '#333'], boxSizing: 'border-box' },
    row: {
        display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
        '&>*': { flexShrink: 0, maxWidth: '100%', marginRight: '1em', marginBottom: 4, '&:hover': { backgroundColor: 'red' } }
    },
    focus: {
        backgroundColor: 'green',
        '&:focus-within': { backgroundColor: theme.gray50 }
    },
}));

const Entry = ({ project, issue, activity, hours, comments, disabled, onSelect }) => {
    const classes = useStyles();
    const { url } = useSettings();
    return <div className={classes.entry}>
        <div className={classes.hours}>
            <svg height="50" width="50">
                <circle cx="25" cy="25" r="20" stroke="#263137" strokeWidth="6" fill="none" /> {/* TODO: theme.gray50 */}
                <circle cx="25" cy="25" r="20.5" stroke="#50AF4C" strokeWidth="8" strokeDasharray={[16.1 * hours, 280]} fill="none" transform="rotate(-90,25,25)" /> {/* TODO: theme.green500 */}
            </svg>
            <b>{hours}h</b>
            <button disabled={disabled} onClick={onSelect}><FiEdit /></button>
        </div>
        <label className={classes.activity}>{activity.name}</label>
        <label>{project.name}{issue && <> <a tabIndex="-1" href={`${url}/projects/${issue.id}`} target={'_blank'}>#{issue.id}</a> {issue.subject}</>}</label>
        <div className={classes.comments}>{comments}</div>
    </div>
};

export const Day = ({ day, entries, selected, onSelectDay, onSelectEntry }) => {
    const classes = useStyles();
    const refs = useRef({ list: undefined });

    const { hours: [start, end] } = useSettings();
    const sum = end - start;
    const reported = useMemo(() => entries.reduce((hours, entry) => hours + entry.hours || 0, 0), [entries]);
    const ellapsed = useMemo(() => {
        const now = dayjs();
        if (!now.isSame(day, 'day')) return sum;
        const hours = now.hour() + now.minute() / 60;
        return Math.min(hours, end) - Math.min(hours, start);
    }, []);
    const [{ height }, setSpring] = useSpring(() => ({ height: 0, immediate: true }));
    useAsyncEffect(async () => {
        const height = selected ? refs.current.list.scrollHeight : 0;
        await Promise.all(setSpring.start({ height }));
    }, undefined, [entries, selected]);
    return <>
        <div className={classes.base}>
            <label onClick={onSelectDay}>{day}</label>
            <b>{reported}h</b>
            <div>
                <div className={classes.bar}>
                    <div><div className={classes.ellapsed} style={{ width: `${ellapsed / sum * 100}%` }}></div></div>
                    <div>{entries && entries.map(({ id, hours, activity }) =>
                        <div key={id} className={classes.spent} title={`${hours}h ${activity.name || '?'}`} style={{ width: `${hours / sum * 100}%` }}></div>)}
                    </div>
                </div>
            </div>
        </div>
        <animated.div ref={ref => refs.current.list = ref} style={{ height, overflow: 'hidden' }}>
            {entries.map(entry => <Entry key={entry.id} {...entry} disabled={!selected} onSelect={onSelectEntry(entry)} />)}
        </animated.div>
    </>
};
