import React, { useState, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { createUseStyles } from 'react-jss';
import { FiRefreshCw, FiClock, FiSettings } from 'react-icons/fi';
import { database, useAsyncEffect, useSettings } from './storage.js';
import { Editor } from './Editor.jsx';
import { Day } from './Day.jsx';
import { Task } from './Task.jsx';
import { Config } from './Config.jsx';

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
        'body': { width: 460, minHeight: 300, margin: 10 },
        'input, textarea, button': {
            display: 'inline-block', backgroundColor: 'transparent', color: theme.font,
            border: 'none', margin: 1, padding: [4, 6], boxSizing: 'border-box', resize: 'none',
            '&:focus': { outline: 'none' } // outline: [1, 'solid', theme.gray700]
        },
        'button': {
            display: 'inline-block', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', borderRadius: 4,
            '&:hover, &:focus': { backgroundColor: theme.gray200 },
            '&:disabled': { color: theme.gray500, backgroundColor: theme.gray50, cursor: 'auto' }
        },
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
    base: { display: 'flex', '&>input': { flexGrow: 1 } }
}));

export const Layout = () => {
    const classes = useStyles();
    const refs = useRef({ entry: undefined, task: undefined, refresh: undefined, config: undefined });
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState();
    const [entries, setEntries] = useState([]);
    const settings = useSettings();

    const days = [...Array(settings.days)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState(JSON.parse(window.localStorage.getItem('draft'))); // saved in Editor on `unload` event

    const reload = async ({ aborted }) => {
        const tasks = await database.table('tasks').reverse().toArray();
        const entries = await database.table('entries').reverse().toArray();
        const issues = await database.table('issues').bulkGet([...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))]);
        if (aborted) return;
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
        setTasks(tasks); // NOTE: batched updates in React 19
    };
    useAsyncEffect(reload, undefined, []);
    const onRefresh = (event) => {
        event.target.disabled = true;
        // refs.current.refresh.disabled = true;
        chrome.runtime.sendMessage({ type: 'refresh' }, (results) => {
            // console.log({ results });
            event.target.disabled = true;
            results.find(res => res) && reload({});
            // refs.current.refresh.disabled = false;
            // TODO> show notification
        });
    };
    const [config, setConfig] = useState(false);
    const onConfig = () => setConfig(true);
    const throwRedmineError = async (req) => {
        if (req.status === 422) { // 422 Unprocessable Entity
            const { errors } = await req.json(); // API: https://www.redmine.org/projects/redmine/wiki/Rest_api#Validation-errors
            throw errors.join('\r\n');
        }
        throw req.statusText;
    }
    const propsAddTask = ({
        placeholder: 'Add task',
        onKeyDown: async (event) => {
            const { which, target: { value } } = event;
            if (which === 13) {
                const props = { value, created_on: dayjs().toJSON() };
                const id = await database.table('tasks').add(props);
                const task = { id, ...props };
                setTasks(tasks => [task, ...tasks]);
                event.target.value = '';
            }
        }
    });
    const propsEditor = ({
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
                    if (!req.ok) await throwRedmineError(req); // 201 Created: time entry was created
                    const { time_entry: update } = await req.json();
                    await database.table('entries').put(update);
                    setEntries(entries => [{ ...update, issue }, ...entries]);
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
        onSelectDay: () => setToday(day === today ? undefined : day),
        onSelectEntry: (entry) => () => setEntry(entry)
    });
    useEffect(() => refs.current.entry.focus(), []); // focus on add entry button
    return <>
        <Editor {...propsEditor} />
        {config && <Config />}
        <div className={classes.base}>
            <button ref={ref => refs.current.entry = ref} onClick={() => setEntry({ spent_on: today })}><FiClock /></button>
            <input ref={ref => refs.current.task = ref} {...propsAddTask} />
            <button ref={ref => refs.current.refresh = ref} onClick={onRefresh}><FiRefreshCw /></button>
            <button ref={ref => refs.current.config = ref} onClick={onConfig}><FiSettings /></button>
        </div>
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {days.map(day => <Day {...propsDay(day)} />)}
        {error && <pre>{error.toString()}</pre>}
    </>;
};
