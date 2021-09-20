import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ThemeProvider, createUseStyles } from 'react-jss';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { FiRefreshCw, FiClock, FiX, FiEdit } from 'react-icons/fi';
import { database, storage, useAsyncEffect } from './storage.js';
import { themes } from './themes.js';
import { Editor } from './Editor.jsx';

dayjs.extend(duration);
dayjs.extend(relativeTime);

const setup = { days: 7, hours: [8, 16] };
const useStyles = createUseStyles(theme => ({ // color codes: https://www.colorsandfonts.com/color-system
    '@font-face': [{
        fontFamily: 'WorkSans',
        src: 'url("font/work-sans-v11-latin-regular.woff2") format("woff2")',
    }, {
        fontFamily: 'WorkSans',
        fontWeight: 'bold',
        src: 'url("font/work-sans-v11-latin-700.woff2") format("woff2")',
    }],
    '@global': {
        '*': { fontSize: '1rem', lineHeight: 1.625, fontFamily: ['WorkSans', 'Verdana', 'sans-serif'] },
        'a': { color: '#3b82f6', '&:visited': { color: '#3b82f6' } },
        'svg': { margin: [0, 4], verticalAlign: 'middle', strokeWidth: 2.5 },
        'html': { scrollBehavior: 'smooth', backgroundColor: theme.background, color: theme.font },
        'input, textarea, button': { display: 'inline-block', border: 'none', margin: 1, padding: [4, 6], boxSizing: 'border-box', resize: 'none', backgroundColor: 'transparent', color: theme.font, '&:focus': { outline: 'none' } }, // outline: [1, 'solid', theme.gray700]
        'button': { textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', '&:hover, &:focus': { backgroundColor: theme.gray200 } },
        // [scrollbar] https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, border: [2, 'solid', theme.background], backgroundColor: theme.font },
        '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
        '::-webkit-resizer': { backgroundColor: 'transparent' },
        '::-webkit-calendar-picker-indicator': { backgroundColor: 'green', color: 'red' },
        // [number input] remove inc/dec buttons
        'input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' },
        // [date input] remove button
        '::-webkit-calendar-picker-indicator': { background: 'none' }
    },
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
    hours: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, float: 'left',
        '&>b, &>svg, &>button': { position: 'absolute', padding: 0, margin: 0 },
        '&>button': {
            width: 0, height: 36, border: 'none', borderRadius: 18, overflow: 'hidden',
            backgroundColor: theme.gray200, color: theme.font, 
            '&:focus': { width: 36 },
            '&>svg': { fontSize: '1.2rem' },
        },
        '&:hover>button': { width: 36 }
    }
}));

const Timer = ({ start, times }) => {
    const display = useMemo(() => times.map(([start, duration]) => [
        dayjs(start).format(),
        dayjs(start).add(duration).format(),
        duration / 1000 / 60 / 60
    ]), [times]);
    const durations = useMemo(() => times.reduce((durations, [, duration]) => durations + duration, 0), [times]);
    const getDuration = () => start && dayjs().diff(start) || 0;
    const [duration, setDuration] = useState(getDuration());
    useEffect(() => {
        if (!start) return;
        const interval = setInterval(() => {
            setDuration(getDuration());
        }, 1000);
        return () => clearInterval(interval);
    }, [start]);
    return <>
        <FiClock title={dayjs(start).format('HH:mm')} />{((durations + duration) / 1000 / 60 / 60).toFixed(2)}h
        {/* [{ellapsed.toFixed(2)}] {diff * 60} */}
        {display.map(([start, end, duration]) => <div key={start}>{start} - {end} - {duration.toFixed(2)}h <FiX /></div>)}
    </>;
};

const Entry = ({ project, issue, activity, hours, comments, onSelect }) => {
    const classes = useStyles();
    return <div style={{ margin: 2, border: '1px solid #333', padding: 8 }}>
        <div className={classes.hours}>
            <svg height="50" width="50">
                <circle cx="25" cy="25" r="20.5" stroke="#263137" strokeWidth="6" fill="none" />
                <circle cx="25" cy="25" r="20.5" stroke="#50AF4C" strokeWidth="8" strokeDasharray={[16.1 * hours, 280]} fill="none" transform="rotate(-90,25,25)" />
            </svg>
            <b style={{ position: 'absolute' }}>{hours}h</b>
            <button onClick={onSelect}><FiEdit /></button>
        </div>
        <label style={{ backgroundColor: '#2E3C43', borderRadius: 4, padding: '0px 4px', float: 'right' }}>{activity.name}</label>
        <label>{project.name}{issue && <> <a href={'#'}>#{issue.id}</a> {issue.subject}</>}</label>
        <div style={{ color: '#888' }}>{comments}</div>
    </div>
};

const Day = ({ day, entries, selected, onSelectDay, onSelectEntry }) => {
    const classes = useStyles();
    const [start, end] = setup.hours;
    const sum = end - start;
    const ellapsed = dayjs().format('YYYY-MM-DD') === day ? dayjs().hour() - start : sum;
    const hours = useMemo(() => entries.reduce((hours, entry) => hours + entry.hours || 0, 0), [entries]);
    return <>
        <div style={{ display: 'flex' }}>
            <label style={{ width: 100 }} onClick={onSelectDay}>{day}</label>
            <b style={{ width: 50 }}>{hours}h</b>
            <div style={{ flexGrow: 1 }}>
                <div className={classes.bar}>
                    <div><div className={classes.ellapsed} style={{ width: `${ellapsed / sum * 100}%` }}></div></div>
                    <div>{entries && entries.map(({ id, hours, activity }) =>
                        <div key={id} className={classes.spent} title={`${hours}h ${activity.name || '?'}`} style={{ width: `${hours / sum * 100}%` }}></div>)}
                    </div>
                </div>
            </div>
        </div>
        {selected && entries?.map(entry => <Entry key={entry.id} {...entry} onSelect={onSelectEntry(entry)} />)}
    </>
};

// const DataContext = React.createContext();
// const DataProvider = DataContext.Provider;
// const useData = () => useContext(DataContext);

const Layout = () => {
    const classes = useStyles();
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState();
    const [entries, setEntries] = useState([]);
    const [settings, setSettings] = useState({});
    useAsyncEffect(async ({ aborted }) => {
        const settings = await storage.get(['url', 'key', 'days', 'hours']);
        const tasks = await database.table('tasks').toArray();
        const entries = await database.table('entries').toArray();
        const issues = await database.table('issues').bulkGet([...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))]);
        if (aborted) return;
        setSettings(settings); // NOTE: batched updates in React 19
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
        setTasks(tasks);
    }, undefined, []);

    const days = [...Array(settings.days)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState();

    const onRefresh = () => {
        chrome.runtime.sendMessage({ type: 'refresh' }, (response) => {
            console.log(response);
        });
        // chrome.runtime.sendMessage({ type: 'test' }, (response) => {
        //     console.log(response);
        // });
    };
    const throwRedmineError = async (req) => {
        if (req.status === 422) { // 422 Unprocessable Entity
            const { errors } = await req.json(); // API: https://www.redmine.org/projects/redmine/wiki/Rest_api#Validation-errors
            throw errors.join('\r\n');
        }
        throw req.statusText;
    }
    const propsEditor = (entry) => ({
        entry,
        onSubmit: async ({ id, activity, hours, project, issue, comments, spent_on }) => {
            try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry
                const { url, key } = settings;
                const body = JSON.stringify({
                    time_entry: {
                        project_id: project?.id || null,
                        issue_id: issue?.id || null,
                        activity_id: activity?.id || null,
                        hours, comments, spent_on
                    }
                });
                if (id) { // update
                    const put = await fetch(`${url}/time_entries/${id}.json`, { headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': key }, method: 'PUT', body });
                    if (!put.ok) await throwRedmineError(put); // 204 No Content: time entry was updated
                    const req = await fetch(`${url}/time_entries/${id}.json`, { headers: { 'X-Redmine-API-Key': key }, method: 'GET' }); // TODO: how to get `updated_on`?
                    if (!req.ok) await throwRedmineError(req);
                    const { time_entry: update } = await req.json(); // 200 OK
                    await database.table('entries').put(update);
                    setEntries(entries => entries.map(entry => entry.id === id ? { ...update, issue } : entry));
                } else { // create
                    const req = await fetch(`${url}/time_entries.json`, { headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': key }, method: 'POST', body });
                    if (!req.ok) throw throwRedmineError(req); // 201 Created: time entry was created
                    const { time_entry: update } = await req.json();
                    await database.table('entries').put(update);
                    setEntries(entries => entries.concat({ ...update, issue }));
                }
            } catch (error) {
                setError(error);
            } finally {
                setEntry();
            }
        },
        onDelete: async ({ id }) => {
            try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry
                const { url, key } = settings;
                const req = await fetch(`${url}/time_entries/${id}.json`, { headers: { 'X-Redmine-API-Key': key }, method: 'DELETE' });
                if (!req.ok) await throwRedmineError(req);
                await database.table('entries').delete(id);
                setEntries(entries => entries.filter(entry => entry.id !== id));
            } catch (error) {
                setError(error);
            } finally {
                setEntry();
            }
        },
        onDuplicate: (entry) => setEntry(entry),
        onDismiss: () => setEntry()
    });
    const propsDay = (day) => ({
        day, key: day, selected: day === today, entries: entries?.filter(entry => entry.spent_on === day) || [],
        onSelectDay: () => setToday(day),
        onSelectEntry: (entry) => () => setEntry(entry)
    });
    useEffect(() => {
        const callback = (message, sender) => {
            if (sender.id !== chrome.runtime.id) return;
            console.log({ message });
        };
        chrome.runtime.onMessage.addListener(callback);
        return () => chrome.runtime.onMessage.removeListener(callback);
    }, []);
    return <div style={{ width: 460 }}>
        <Editor {...propsEditor(entry)} />
        <button onClick={onRefresh}><FiRefreshCw /></button>
        {/* <button onClick={() => raiseToast('testing2')}>Task</button> */}
        {/* <button style={{ backgroundColor: '#999' }}>Time</button> */}
        {days.map(day => <Day {...propsDay(day)} />)}
        {error && <pre>{error.toString()}</pre>}
    </div>;
};

const Popup = () => {
    const [theme, setTheme] = useState();
    useAsyncEffect(async ({ aborted }) => {
        const settings = await storage.get('theme');
        if (aborted) return;
        setTheme(themes[settings.theme] || themes['dark']);
    }, undefined, []);
    return theme && <ThemeProvider theme={theme}><Layout /></ThemeProvider> || null;
};

export default Popup;