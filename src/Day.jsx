import React, { useMemo } from 'react';
import { createUseStyles } from 'react-jss';
import dayjs from 'dayjs';
import { FiEdit } from 'react-icons/fi';
import { Collapsible } from './atoms/Collapsible.jsx';

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
    spent: { backgroundColor: theme.success, border: [1, 'solid', theme.card.border], boxSizing: 'border-box' },
    note: { margin: 4 }
}));

const Entry = ({ project, issue, activity, hours, sumHours, comments, baseUrl, disabled, onSelect }) => {
    const classes = useStyles();
    const url = issue && `${baseUrl}/issues/${issue.id}`;
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
                <b>{+hours.toFixed(2)}h</b>
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
    return <>
        <div className={classes.day}>
            <button title={title} onClick={onSelectDay}>{day}</button>
            <b>{reported}h</b>
            <div className={classes.bar}>
                <div><div className={classes.ellapsed} style={{ width: `${ellapsed / sumHours * 100}%` }}></div></div>
                <div>{entries && entries.map(({ id, hours, activity }) =>
                    <div key={id} className={classes.spent} title={`${+hours.toFixed(2)}h ${activity.name || '?'}`} style={{ width: `${hours / sumHours * 100}%` }}></div>)}
                </div>
            </div>
        </div>
        <Collapsible open={selected}>
            {entries.map(entry => <Entry key={entry.id} {...entry} baseUrl={baseUrl} sumHours={sumHours} disabled={!selected} onSelect={onSelectEntry(entry)} />)}
            {!entries.length && <small className={classes.note}>No time entries</small>}
        </Collapsible>
    </>
};
