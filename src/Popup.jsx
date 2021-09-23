import React, { useContext, useState, useEffect, useMemo } from 'react';
import { Globals } from 'react-spring';
import { ThemeProvider, createUseStyles } from 'react-jss';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { FiRefreshCw, FiClock, FiX, FiEdit, FiPlusSquare } from 'react-icons/fi';
import { database, storage, useAsyncEffect } from './storage.js';
import { themes } from './themes.js';
import { Editor } from './Editor.jsx';
import { Task } from './Task.jsx';

dayjs.extend(duration);
dayjs.extend(relativeTime);

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
        'button': { textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', borderRadius: 4, '&:hover, &:focus': { backgroundColor: theme.gray200 } },
        // [scrollbar] https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, border: [2, 'solid', theme.background], backgroundColor: theme.gray150 },
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
                <circle cx="25" cy="25" r="20.5" stroke="#263137" strokeWidth="6" fill="none" /> {/* TODO: theme.gray50 */}
                <circle cx="25" cy="25" r="20.5" stroke="#50AF4C" strokeWidth="8" strokeDasharray={[16.1 * hours, 280]} fill="none" transform="rotate(-90,25,25)" /> {/* TODO: theme.green500 */}
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
    const { hours: [start, end] } = useSettings();
    const sum = end - start;
    const ellapsed = useMemo(() => dayjs().isSame(day, 'day') ? Math.min(dayjs().hour(), end) - start : sum, []);
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
        {selected && entries.map(entry => <Entry key={entry.id} {...entry} onSelect={onSelectEntry(entry)} />)}
    </>
};

const Layout = () => {
    const classes = useStyles();
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState();
    const [entries, setEntries] = useState([]);
    const settings = useSettings();
    useAsyncEffect(async ({ aborted }) => {
        const tasks = await database.table('tasks').reverse().toArray();
        const entries = await database.table('entries').reverse().toArray();
        const issues = await database.table('issues').bulkGet([...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))]);
        if (aborted) return;
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
        setTasks(tasks); // NOTE: batched updates in React 19
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
    const propsTaskAdd = ({
        placeholder: 'Add task',
        onKeyDown: async (event) => {
            const { which, target: { value } } = event;
            if (which === 13) {
                const props = { value, done: false, color: 'green', created_on: dayjs().toJSON(), updated_on: dayjs().toJSON() };
                const id = await database.table('tasks').add(props);
                const task = { id, ...props };
                setTasks(tasks => [task, ...tasks]);
                event.target.value = '';
            }
        }
    });
    const propsEditor = (entry) => ({
        entry,
        onSubmit: async ({ id, project, issue, hours, activity, comments, spent_on }) => {
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
                    const req = await fetch(`${url}/time_entries/${id}.json`, { headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': key }, method: 'PUT', body });
                    if (!req.ok) await throwRedmineError(req); // 204 No Content: time entry was updated
                    const update = { // Prop `updated_on` not updated -> refresh by `background.js`
                        ...project && { project: { id: project.id, name: project.name } },
                        ...issue && { issue: { id: issue.id } },
                        ...activity && { activity: { id: activity.id, name: activity.name } },
                        hours, comments, spent_on
                    };
                    await database.table('entries').update(id, update);
                    setEntries(entries => entries.map(entry => entry.id === id ? { ...entry, ...update, issue } : entry));
                } else { // create
                    const req = await fetch(`${url}/time_entries.json`, { headers: { 'Content-Type': 'application/json', 'X-Redmine-API-Key': key }, method: 'POST', body });
                    if (!req.ok) throw throwRedmineError(req); // 201 Created: time entry was created
                    const { time_entry: update } = await req.json();
                    await database.table('entries').put(update);
                    setEntries(entries => [{ ...update, issue }, entries]);
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
    const filteredTasks = useMemo(() => tasks.filter(({ closed_on }) => !closed_on || dayjs(today).isSame(closed_on, 'day')), [tasks, today]);
    const propsTask = (task) => ({
        task, key: task.id,
        onChange: async (props) => {
            try {
                const { id } = task;
                await database.table('tasks').update(id, props);
                setTasks(tasks => tasks.map(task => task.id === id ? { ...task, ...props } : task));
            } catch (error) {
                setError(error);
            }
        },
        onDelete: async () => {
            try {
                const { id } = task;
                await database.table('tasks').delete(id);
                setTasks(tasks => tasks.filter(task => task.id !== id));
            } catch (error) {
                setError(error);
            } finally {
                setEntry();
            }
        }
    });
    const filteredEntries = useMemo(() => entries.reduce((entries, entry) => ({ ...entries, [entry.spent_on]: [...entries[entry.spent_on] || [], entry] }), {}), [entries]);
    const propsDay = (day) => ({
        day, key: day, selected: day === today, entries: filteredEntries[day] || [],
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
        <button onClick={() => setEntry({ spent_on: today })}><FiClock /></button>
        <input {...propsTaskAdd} />
        <button onClick={onRefresh}><FiRefreshCw /></button>
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {/* <button onClick={() => raiseToast('testing2')}>Task</button> */}
        {/* <button style={{ backgroundColor: '#999' }}>Time</button> */}
        {days.map(day => <Day {...propsDay(day)} />)}
        {error && <pre>{error.toString()}</pre>}
    </div>;
};

const SettingsContext = React.createContext();
const SettingsProvider = SettingsContext.Provider;
export const useSettings = () => useContext(SettingsContext);

const Popup = () => {
    const [settings, setSettings] = useState();
    const theme = themes[settings?.theme] || themes['dark'];
    useAsyncEffect(async ({ aborted }) => {
        const settings = await storage.get();
        if (aborted) return;
        setSettings(settings);
        const { skipAnimation } = settings;
        skipAnimation && Globals.assign({ skipAnimation }); // turn off spring animations
    }, undefined, []);
    return settings && <SettingsProvider value={settings}>
        <ThemeProvider theme={theme}><Layout /></ThemeProvider>
    </SettingsProvider> || null;
};

export default Popup;