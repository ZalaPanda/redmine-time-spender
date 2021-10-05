import React, { useState, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { createUseStyles } from 'react-jss';
import { FiRefreshCw, FiClock, FiSettings } from 'react-icons/fi';
import { database, useAsyncEffect, useRaise, useSettings, storage } from './storage.js';
import { Editor } from './Editor.jsx';
import { Day } from './Day.jsx';
import { Task } from './Task.jsx';
import { Config } from './Config.jsx';
import { Toaster } from './Toaster.jsx';

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
        '*': { fontSize: 16, lineHeight: theme.spacing, fontFamily: ['WorkSans', 'Verdana', 'sans-serif'] },
        'a': { fontWeight: 'bold', color: theme.special, '&:visited': { color: theme.special } },
        'svg': { margin: 2, verticalAlign: 'middle', strokeWidth: 2.5 },
        'html': { scrollBehavior: 'smooth', backgroundColor: theme.bg, color: theme.text },
        'body': { width: 460, minHeight: 300, margin: 10 },
        'input, textarea, button': {
            display: 'inline-block', backgroundColor: 'transparent', color: theme.text,
            border: 'none', margin: 1, padding: [4, 6], boxSizing: 'border-box', resize: 'none',
            '&:focus': { outline: 'none' },
            '&:disabled': { filter: 'opacity(0.6)', cursor: 'auto' }
        },
        'button': {
            display: 'inline-block', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', borderRadius: 4,
            '&:hover, &:focus': { backgroundColor: theme.specialBg },
            '&:active': { backgroundColor: theme.special }
        },
        '::selection': { backgroundColor: theme.mark },
        // [scrollbar] https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, border: [2, 'solid', theme.bg], backgroundColor: theme.specialBg },
        '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
        '::-webkit-resizer': { backgroundColor: 'transparent' },
        // [number input] remove inc/dec buttons
        'input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' },
        // [date input] remove button
        '::-webkit-calendar-picker-indicator': { background: 'none' }
    },
    base: { display: 'flex', '&>input': { flexGrow: 1 } }
}));

// API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries
const refreshEntries = async (url, key, days) => {
    const from = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    await database.table('entries').where('spent_on').below(from).delete(); // remove old entries // .filter(entry => entry.spent_on < from)
    const last = await database.table('entries').orderBy('updated_on').last() || {};
    const entries = [];
    while (true) {
        const req = await fetch(`${url}/time_entries.json?user_id=me&limit=100&offset=${entries.length}&from=${from}`, { headers: { 'X-Redmine-API-Key': key } });
        const { time_entries: chunk, total_count: total, offset, limit } = await req.json();
        entries.push(...chunk); // { id, project, issue, user, activity, hours, comments, spent_on, created_on, updated_on }
        if (total <= limit + offset) break;
    }
    if (last?.updated_on && !entries.find(entry => entry.updated_on > last.updated_on)) return;
    return await database.table('entries').bulkPut(entries);
};

// API: https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects
const refreshProjects = async (url, key) => { // full sync
    const last = await database.table('projects').orderBy('updated_on').last() || {};
    const projects = [];
    while (true) {
        const req = await fetch(`${url}/projects.json?limit=100&offset=${projects.length}`, { headers: { 'X-Redmine-API-Key': key } });
        const { projects: chunk, total_count: total, offset, limit } = await req.json();
        projects.push(...chunk); // { id, name, identifier, description, created_on, updated_on }
        if (total <= limit + offset) break;
    }
    if (last?.updated_on && !projects.find(project => project.updated_on > last.updated_on)) return;
    await database.table('projects').clear();
    return await database.table('projects').bulkAdd(projects);
};

// API: https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues
const refreshIssues = async (url, key) => { // incremental sync
    const last = await database.table('issues').orderBy('updated_on').last() || {};
    const issues = [];
    while (true) {
        const req = await fetch(`${url}/issues.json?limit=100&offset=${issues.length}&status_id=*${last?.updated_on ? `&updated_on=>=${last.updated_on}` : ''}`, { headers: { 'X-Redmine-API-Key': key } });
        const { issues: chunk, total_count: total, offset, limit } = await req.json();
        issues.push(...chunk); // { id, project, subject, description, created_on, updated_on, closed_on }
        if (total <= limit + offset) break;
    }
    if (last?.updated_on && !issues.find(issue => issue.updated_on > last.updated_on)) return;
    return await database.table('issues').bulkPut(issues);
};

// API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
const refreshActivities = async (url, key) => {
    const req = await fetch(`${url}/enumerations/time_entry_activities.json`, { headers: { 'X-Redmine-API-Key': key } });
    const { time_entry_activities: activities } = await req.json();
    await database.table('activities').bulkPut(activities); // { id, name, active }
};

export const Layout = () => {
    const classes = useStyles();
    const refs = useRef({ entry: undefined, task: undefined, refresh: undefined, config: undefined });
    const raiseError = useRaise('error');

    const [tasks, setTasks] = useState([]);
    const [entries, setEntries] = useState([]);
    const settings = useSettings();

    const days = [...Array(settings.days)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState(JSON.parse(window.localStorage.getItem('draft'))); // saved in Editor on `unload` event

    const refresh = async () => {
        try {
            refs.current.refresh.disabled = true; // TODO: move to event handler
            const { url, key, days } = settings;
            const results = await Promise.all([
                refreshEntries(url, key, days),
                refreshProjects(url, key),
                refreshIssues(url, key),
                refreshActivities(url, key)
            ]);
            if (!results.find(res => res)) return;
            await storage.set({ refresh: dayjs().toJSON() });
        } catch (error) {
            raiseError(error);
        } finally {
            refs.current.refresh.disabled = false; // TODO: move to event handler
        }
    };
    useAsyncEffect(async ({ aborted }) => { // load projects/issues/activities after load
        console.log(settings);
        const tasks = await database.table('tasks').reverse().toArray();
        const entries = await database.table('entries').reverse().toArray();
        const issues = await database.table('issues').bulkGet([...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))]);
        if (aborted) return;
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
        setTasks(tasks); // NOTE: batched updates in React 19
    }, undefined, [settings?.refresh]);

    const onRefresh = () => {
        refresh();
    };
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
                setEntry();
                refs.current.entry.focus();
            } catch (error) {
                raiseError(error);
            }
        },
        onDelete: async ({ id }) => {
            try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry
                const { url, key } = settings;
                const req = await fetch(`${url}/time_entries/${id}.json`, { headers: { 'X-Redmine-API-Key': key }, method: 'DELETE' });
                if (!req.ok) await throwRedmineError(req);
                await database.table('entries').delete(id);
                setEntries(entries => entries.filter(entry => entry.id !== id));
                refs.current.entry.focus();
                setEntry();
            } catch (error) {
                raiseError(error);
            }
        },
        onDuplicate: (entry) => setEntry(entry),
        onDismiss: () => setEntry() || refs.current.entry.focus()
    });

    const [config, setConfig] = useState(false);
    const onConfig = () => setConfig(true);
    const propsConfig = {
        onRefresh, onDismiss: () => setConfig(false)
    };

    const filteredTasks = useMemo(() => tasks.filter(({ closed_on }) => !closed_on || dayjs(today).isSame(closed_on, 'day')), [tasks, today]);
    const propsTask = (task) => ({
        task, key: task.id,
        onChange: async (props) => {
            try {
                const { id } = task;
                await database.table('tasks').update(id, props);
                setTasks(tasks => tasks.map(task => task.id === id ? { ...task, ...props } : task));
            } catch (error) {
                raiseError(error);
            }
        },
        onDelete: async () => {
            try {
                const { id } = task;
                await database.table('tasks').delete(id);
                setTasks(tasks => tasks.filter(task => task.id !== id));
            } catch (error) {
                raiseError(error);
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
        {config && <Config {...propsConfig} />}
        <Toaster />
        <div className={classes.base}>
            <button ref={ref => refs.current.entry = ref} title={'Add time entry'} onClick={() => setEntry({ spent_on: today })}><FiClock /></button>
            <input ref={ref => refs.current.task = ref} {...propsAddTask} />
            <button ref={ref => refs.current.refresh = ref} title={'Refresh'} onClick={onRefresh}><FiRefreshCw /></button>
            <button ref={ref => refs.current.config = ref} title={'Configuration'} onClick={onConfig}><FiSettings /></button>
        </div>
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {days.map(day => <Day {...propsDay(day)} />)}
    </>;
};
