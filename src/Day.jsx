import React, { useMemo, useRef } from 'react';
import { useSpring, animated } from 'react-spring';
import { createUseStyles } from 'react-jss';
import dayjs from 'dayjs';
import { FiEdit } from 'react-icons/fi';
import { useAsyncEffect } from './storage.js';

const useStyles = createUseStyles(theme => ({ // color codes: https://www.colorsandfonts.com/color-system
    base: {
        display: 'flex', alignItems: 'center',
        '&>label': { width: 100 },
        '&>b': { width: 50 },
        '&>div': { flexGrow: 1 }
    },
    entry: { position: 'relative', margin: 2, border: [1, 'solid', theme.border], padding: [8, 4], minHeight: 50 },
    hours: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, float: 'left',
        '&>b, &>svg, &>button': { position: 'absolute', padding: 0, margin: 0 },
        '&>button': {
            width: 38, height: 38, border: 'none', borderRadius: 20, overflow: 'hidden', opacity: 0,
            '&:focus, &:hover': { opacity: 1 },
            '&>svg': { fontSize: 20 },
        }
    },
    project: {},
    issue: { color: theme.special },
    activity: { backgroundColor: theme.specialBg, color: theme.specialText, borderRadius: 4, padding: [0, 6], float: 'right' },
    comments: { color: theme.textSoft },
    bar: {
        position: 'relative', height: 12,
        '&>div': { position: 'absolute', display: 'flex', width: '100%', height: '100%' }
    },
    ellapsed: { backgroundColor: theme.danger, margin: [4, 0], boxSizing: 'border-box' },
    spent: { backgroundColor: theme.success, border: [1, 'solid', theme.subtle], boxSizing: 'border-box' }
}));

const Entry = ({ project, issue, activity, hours, comments, baseUrl, disabled, onSelect }) => {
    const classes = useStyles();
    return <div className={classes.entry}>
        <div className={classes.hours}>
            <svg height="50" width="50">
                <circle cx="25" cy="25" r="20" stroke="#263137" strokeWidth="6" fill="none" /> {/* TODO: theme.gray50 */}
                <circle cx="25" cy="25" r="20" stroke="#50AF4C" strokeWidth="8" strokeDasharray={[16.1 * hours, 280]} fill="none" transform="rotate(-90,25,25)" /> {/* TODO: theme.green500 */}
            </svg>
            <b>{hours}h</b>
            <button disabled={disabled} onClick={onSelect}><FiEdit /></button>
        </div>
        <label className={classes.activity}>{activity.name}</label>
        <label className={classes.project}>{project.name}</label>
        {issue && <label className={classes.issue}> <a tabIndex="-1" href={`${baseUrl}/projects/${issue.id}`} target={'_blank'}>#{issue.id}</a> {issue.subject}</label>}
        <div className={classes.comments}>{comments}</div>
    </div>
};

export const Day = ({ day, entries, workHours, baseUrl, selected, onSelectDay, onSelectEntry }) => {
    const classes = useStyles();
    const refs = useRef({ list: undefined });

    const [start, end] = workHours || [8, 16];
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
    }, [entries, selected]);
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
            {entries.map(entry => <Entry key={entry.id} {...entry} baseUrl={baseUrl} disabled={!selected} onSelect={onSelectEntry(entry)} />)}
        </animated.div>
    </>
};
