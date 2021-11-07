import React, { useMemo, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { createUseStyles } from 'react-jss';
import dayjs from 'dayjs';
import { FiEdit } from 'react-icons/fi';
import { useAsyncEffect } from './apis/uses.js';

const useStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    day: {
        display: 'flex', alignItems: 'center',
        '&>button': { padding: 0, margin: 0, minWidth: 90 },
        '&>b': { minWidth: 50, padding: [0, 4] },
        '&>div': { flexGrow: 1 }
    },
    entry: { position: 'relative', margin: 3, border: [1, 'solid', theme.card.border], padding: 4, minHeight: 50 },
    hours: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, float: 'left',
        '&>svg, &>button': { position: 'absolute', padding: 0, margin: 0 },
        '&>svg': {
            '&>circle': { stroke: theme.mark },
            '&>circle[stroke-dasharray]': { stroke: theme.success }
        },
        '&>button': {
            width: 40, height: 40, border: 'none', borderRadius: 20, overflow: 'hidden',
            '&>svg': { fontSize: 20, display: 'none' },
            '&>b': { fontSize: 14, userSelect: 'none' },
            '&:focus, &:hover': {
                '&>svg': { display: 'inline' },
                '&>b': { display: 'none' }
            },
        }
    },
    project: {},
    issue: { color: theme.special },
    activity: { backgroundColor: theme.badge.bg, color: theme.badge.text, borderRadius: 4, padding: [0, 6], float: 'right' },
    comments: { color: theme.muted },
    bar: {
        position: 'relative', height: 12,
        '&>div': { position: 'absolute', display: 'flex', width: '100%', height: '100%' }
    },
    ellapsed: { backgroundColor: theme.danger, margin: [4, 0], boxSizing: 'border-box' },
    spent: { backgroundColor: theme.success, border: [1, 'solid', theme.card.border], boxSizing: 'border-box' }
}));

const Entry = ({ project, issue, activity, hours, sumHours, comments, baseUrl, disabled, onSelect }) => {
    const classes = useStyles();
    const url = issue && `${baseUrl}/projects/${issue.id}`;
    const propsGrayCircle = ({
        cx: 25, cy: 25, r: 20, strokeWidth: 6, fill: 'none'
    });
    const propsGreenCircle = ({
        cx: 25, cy: 25, r: 20, strokeWidth: 8, strokeDasharray: [125.6 * hours / sumHours, 200], fill: 'none', transform: 'rotate(-90,25,25)'
    });
    const propsLink = ({
        href: url, target: '_blank', tabIndex: -1,
        onClick: event => {
            event.preventDefault();
            chrome.tabs.create({ url, active: false });
        }
    });
    return <div className={classes.entry}>
        <div className={classes.hours}>
            <svg height={50} width={50}>
                <circle {...propsGrayCircle} />
                <circle {...propsGreenCircle} />
            </svg>
            <button disabled={disabled} onClick={onSelect}>
                <b>{hours}h</b>
                <FiEdit />
            </button>
        </div>
        <label className={classes.activity}>{activity.name}</label>
        <label className={classes.project}>{project.name}</label>
        {issue && <label className={classes.issue}> <a {...propsLink}>#{issue.id}</a> {issue.subject}</label>}
        <div className={classes.comments}>{comments}</div>
    </div>
};

export const Day = ({ day, entries, workHours, baseUrl, selected, onSelectDay, onSelectEntry }) => {
    const classes = useStyles();
    const refs = useRef({ list: undefined });

    const [start, end] = workHours || [8, 16];
    const sumHours = end - start;
    const title = useMemo(() => dayjs(day).format('dddd'), [day]); // Day of Week
    const reported = useMemo(() => entries.reduce((hours, entry) => hours + entry.hours || 0, 0), [entries]);
    const ellapsed = useMemo(() => {
        const now = dayjs();
        if (!now.isSame(day, 'day')) return sumHours;
        const hours = now.hour() + now.minute() / 60;
        return Math.min(hours, end) - Math.min(hours, start);
    }, []);
    const [{ height }, setSpring] = useSpring(() => ({ height: 0, immediate: true }));
    useAsyncEffect(async () => {
        const height = selected ? refs.current.list.scrollHeight : 0;
        await Promise.all(setSpring.start({ height }));
    }, [entries, selected]);
    return <>
        <div className={classes.day}>
            <button title={title} onClick={onSelectDay}>{day}</button>
            <b>{reported}h</b>
            <div className={classes.bar}>
                <div><div className={classes.ellapsed} style={{ width: `${ellapsed / sumHours * 100}%` }}></div></div>
                <div>{entries && entries.map(({ id, hours, activity }) =>
                    <div key={id} className={classes.spent} title={`${hours}h ${activity.name || '?'}`} style={{ width: `${hours / sumHours * 100}%` }}></div>)}
                </div>
            </div>
        </div>
        <animated.div ref={ref => refs.current.list = ref} style={{ height, overflow: 'hidden' }}>
            {entries.map(entry => <Entry key={entry.id} {...entry} baseUrl={baseUrl} sumHours={sumHours} disabled={!selected} onSelect={onSelectEntry(entry)} />)}
        </animated.div>
    </>
};
