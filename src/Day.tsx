import { useMemo, MouseEvent, HTMLAttributes } from 'react';
import { css, Theme } from '@emotion/react';
import { margin, padding } from 'polished';
import { FiEdit } from 'react-icons/fi';
import { Collapsible } from './atoms/Collapsible';
import dayjs from 'dayjs';
import { EntryExt } from './apis/redmine';

const dayStyles = css({
    display: 'flex', alignItems: 'center',
    '&>button': { textAlign: 'left', padding: 0, margin: 0, minWidth: 90 },
    '&>b': { minWidth: 50, ...padding(0, 4) },
    '&>div': { flexGrow: 1 }
});
const entryStyles = (theme: Theme) => css({
    position: 'relative', margin: 3, borderWidth: 1, borderStyle: 'solid', borderColor: theme.card.border, padding: 4, minHeight: 50
});
const hoursStyles = (theme: Theme) => css({
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
});
const issueStyles = (theme: Theme) => css({
    color: theme.special
});
const activityStyles = (theme: Theme) => css({
    backgroundColor: theme.badge.bg, color: theme.badge.text, borderRadius: 4, ...padding(0, 6), float: 'right'
});
const commentsStyles = (theme: Theme) => css({
    color: theme.muted
});
const barStyles = css({
    position: 'relative', height: 12,
    '&>div': { position: 'absolute', display: 'flex', width: '100%', height: '100%' }
});
const ellapsedStyles = (theme: Theme) => css({ backgroundColor: theme.danger, ...margin(4, 0), boxSizing: 'border-box' });
const spentStyles = (theme: Theme) => css({ backgroundColor: theme.success, borderWidth: 1, borderStyle: 'solid', borderColor: theme.card.border, boxSizing: 'border-box' });
const noteStyles = css({ margin: 4 });

interface DayEntryProps extends EntryExt {
    sumHours: number,
    baseUrl: string,
    disabled: boolean,
    onSelect: () => void
};

const DayEntry = ({ project, issue, activity, hours, sumHours, comments, baseUrl, disabled, onSelect }: DayEntryProps) => {
    const url = issue && `${baseUrl}/issues/${issue.id}`;
    const propsGrayCircle = ({
        cx: 25, cy: 25, r: 20, strokeWidth: 6, fill: 'none'
    });
    const propsGreenCircle = ({
        cx: 25, cy: 25, r: 20, strokeWidth: 8, strokeDasharray: [125.6 * hours / sumHours, 200].join(','), fill: 'none', transform: 'rotate(-90,25,25)'
    });
    const propsLink = ({
        href: url, target: '_blank', tabIndex: -1,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            chrome.tabs.create({ url, active: false });
        }
    });
    return <div css={entryStyles}>
        <div css={hoursStyles}>
            <svg height={50} width={50}>
                <circle {...propsGrayCircle} />
                <circle {...propsGreenCircle} />
            </svg>
            <button disabled={disabled} onClick={onSelect}>
                <b>{+hours.toFixed(2)}h</b>
                <FiEdit />
            </button>
        </div>
        <label css={activityStyles}>{activity.name}</label>
        <label>{project.name}</label>
        {issue && <label css={issueStyles}> <a {...propsLink}>#{issue.id}</a> {issue.subject}</label>}
        <div css={commentsStyles}>{comments}</div>
    </div>
};

interface DayProps extends HTMLAttributes<HTMLDivElement> {
    day: string,
    entries: EntryExt[],
    workHours: number[],
    baseUrl: string,
    selected: boolean,
    onSelectDay: () => void,
    onSelectEntry: (entry: EntryExt) => () => void
};

export const Day = ({ day, entries, workHours, baseUrl, selected, onSelectDay, onSelectEntry }: DayProps) => {
    const [start, end] = workHours || [8, 16];
    const sumHours = end - start;
    const title = useMemo(() => dayjs(day).format('dddd'), [day]); // Day of Week
    const reported = useMemo(() => entries.reduce((hours: number, entry: { hours: number }) => hours + entry.hours || 0, 0), [entries]);
    const ellapsed = useMemo(() => {
        const now = dayjs();
        if (!now.isSame(day, 'day')) return sumHours;
        const hours = now.hour() + now.minute() / 60;
        return Math.min(hours, end) - Math.min(hours, start);
    }, []);
    return <>
        <div css={dayStyles}>
            <button title={title} onClick={onSelectDay}>{day}</button>
            <b>{reported}h</b>
            <div css={barStyles}>
                <div><div css={ellapsedStyles} style={{ width: `${ellapsed / sumHours * 100}%` }}></div></div>
                <div>{entries && entries.map(({ id, hours, activity }) =>
                    <div key={id} css={spentStyles} title={`${+hours.toFixed(2)}h ${activity.name || '?'}`} style={{ width: `${hours / sumHours * 100}%` }}></div>)}
                </div>
            </div>
        </div>
        <Collapsible open={selected}>
            {entries.map(entry => <DayEntry key={entry.id} {...entry} baseUrl={baseUrl} sumHours={sumHours} disabled={!selected} onSelect={onSelectEntry(entry)} />)}
            {!entries.length && <small css={noteStyles}>No time entries</small>}
        </Collapsible>
    </>
};
