import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Globals } from 'react-spring';
import { ThemeProvider, createUseStyles } from 'react-jss';
import { FiRefreshCw, FiClock, FiSettings } from 'react-icons/fi';

import { storage, database, useAsyncEffect, useRaise } from './storage.js';
import { themes } from './themes.js';
import { genKey, encryptor, decryptor } from './crypto.js';

import dayjs from 'dayjs';

import { Editor } from './Editor.jsx';
import { Day } from './Day.jsx';
import { Task } from './Task.jsx';
import { Config } from './Config.jsx';
import { Toaster } from './Toaster.jsx';

const useGlobalStyles = createUseStyles({
    '@font-face': [{
        fontFamily: 'WorkSans',
        src: 'url("font/work-sans-v11-latin-regular.woff2") format("woff2")',
    }, {
        fontFamily: 'WorkSans',
        fontWeight: 'bold',
        src: 'url("font/work-sans-v11-latin-700.woff2") format("woff2")',
    }],
    '@global': {
        '*': { fontSize: 16, fontFamily: ['WorkSans', 'Verdana', 'sans-serif'] },
        'a': { fontWeight: 'bold' },
        'svg': { margin: 2, verticalAlign: 'middle', strokeWidth: 2.5 },
        'html': { scrollBehavior: 'smooth' },
        'body': { width: 460, minHeight: 300, margin: 10 },
        'input, textarea, button': {
            display: 'inline-block', backgroundColor: 'transparent',
            border: 'none', margin: 1, padding: [4, 6], boxSizing: 'border-box', resize: 'none',
            '&:focus': { outline: 'none' },
            '&:disabled': { filter: 'opacity(0.6)', cursor: 'auto' }
        },
        'button': {
            display: 'inline-block', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', borderRadius: 4
        },
        // [scrollbar] https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, border: [2, 'solid', 'unset'] },
        '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
        '::-webkit-resizer': { backgroundColor: 'transparent' },
        // [number input] remove inc/dec buttons
        'input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' },
        // [date input] remove button
        '::-webkit-calendar-picker-indicator': { background: 'none' }
    },
});

const useThemedStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    '@global': {
        '*': { lineHeight: theme.spacing },
        'a': { color: theme.special, '&:visited': { color: theme.special } },
        'html': { backgroundColor: theme.bg, color: theme.text },
        'input, textarea, button': { color: theme.text },
        'button': {
            '&:hover, &:focus': { backgroundColor: theme.specialBg },
            '&:active': { backgroundColor: theme.special }
        },
        // [selection]
        '::selection': { backgroundColor: theme.mark },
        // [scrollbar]
        '::-webkit-scrollbar-thumb': { borderColor: theme.bg, backgroundColor: theme.specialBg },
    },
    base: { display: 'flex', '&>input': { flexGrow: 1 } }
}));

const cookieName = '_redmine_time_spender';
const cookie = (url) => ({
    get: _ => new Promise((resolve, reject) => chrome.cookies.get({
        name: cookieName, url
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    set: value => new Promise((resolve, reject) => chrome.cookies.set({
        name: cookieName, value, url, httpOnly: true, secure: true, expirationDate: 2147483647
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie)))
});

const fromHexString = hexString => new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const toHexString = bytes => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');


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
    crypto.encrypt(database.table('entries').schema, entries)
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
    console.log(database.table('issues').schema);
    return await database.table('issues').bulkPut(issues);
};

// API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
const refreshActivities = async (redmine) => {
    // const req = await fetch(`${url}/enumerations/time_entry_activities.json`, { headers: { 'X-Redmine-API-Key': key } });
    const req = await redmine('/enumerations/time_entry_activities.json');
    const { time_entry_activities: activities } = await req.json();
    debugger;
    await database.table('activities').bulkPut(activities); // { id, name, active }
};


const App = () => {
    useGlobalStyles();

    /** @type {[Settings, React.Dispatch<(prevState: Settings) => Settings>]} */
    const [settings, setSettings] = useState();
    useAsyncEffect(async ({ aborted }) => { // load settings from local storage.
        const settings = await storage.get();
        if (aborted) return;
        setSettings(settings);
    }, []);

    /** @type {[Theme, React.Dispatch<(prevState: Theme) => Theme>]} */
    const [theme, setTheme] = useState({ ...themes['dark'], lineHeight: 1.6 });
    const classes = useThemedStyles({ theme });

    useEffect(() => { // theme update
        if (!settings?.theme) return;
        const { theme: { isDark = true, lineHeight = 1.6 } } = settings;
        setTheme({ ...themes[isDark ? 'dark' : 'light'], lineHeight })
    }, [settings?.theme]);

    useEffect(() => { // spring animations on/off
        if (!settings) return;
        const { skipAnimation } = settings;
        Globals.assign({ skipAnimation });
    }, [settings?.skipAnimation]);

    const [functions, setFunctions] = useState();
    useAsyncEffect(async ({ aborted }) => { // refresh functions
        if (!settings?.redmine) return;
        const { redmine: { baseUrl, encodedKey } } = settings;
        const { value: cryptoHexKey } = await cookie(baseUrl).get();
        const cryptoKey = fromHexString(cryptoHexKey);
        const encrypt = encryptor(cryptoKey);
        const decrypt = decryptor(cryptoKey);
        const apiKey = decrypt(fromHexString(encodedKey));
        const redmine = (path, method, body) => fetch(baseUrl.concat(path), {
            headers: { 'Content-Type': body && 'application/json', 'X-Redmine-API-Key': apiKey },
            method, body
        });
        if (aborted) return;
        database.tables.map(table => {
            const { schema: { primKey, indexes } } = table;
            const encryptedDataKey = '_data';
            const notEncryptedKeys = [primKey?.name, ...indexes?.map(index => index.name)].filter(name => name);
            // API: https://dexie.org/docs/Table/Table.hook('creating')
            table.hook('creating', (_, item) => {
                const rest = Object.fromEntries(
                    Object.entries(item).filter(([key]) => {
                        if (notEncryptedKeys.includes(key)) return false;
                        delete item[key];
                        return true;
                    })
                );
                item[encryptedDataKey] = encrypt(rest);
            });
            // API: https://dexie.org/docs/Table/Table.hook('reading')
            table.hook('reading', (item) => {
                if (!item.hasOwnProperty(encryptedDataKey)) return item;
                const encryptedDataValue = item[encryptedDataKey];
                const rest = Object.fromEntries(
                    Object.entries(item).filter(([key]) => key !== encryptedDataKey));
                return { ...rest, ...encryptedDataValue && decrypt(encryptedDataValue) };
            });
            // API: https://dexie.org/docs/Table/Table.hook('updating')
            table.hook('updating', (modifications, _, item) => {
                const modificationKeys = Object.entries(modifications).filter(([key]) => notEncryptedKeys.includes(key));
                if (Object.keys(modifications).length === modificationKeys.length) return;
                const encryptedDataValue = item[encryptedDataKey];
                const keys = Object.fromEntries(
                    Object.entries(item).filter(([key]) => key !== encryptedDataKey));
                const updated = { ...keys, ...encryptedDataValue && decrypt(encryptedDataValue), ...modifications };
                const rest = Object.fromEntries(
                    Object.entries(updated).filter(([key]) => !notEncryptedKeys.includes(key)));
                return { ...modificationKeys, [encryptedDataKey]: encrypt(rest) };
            });
        });
        setFunctions({ encrypt, decrypt, redmine });
    }, [settings?.redmine]);

    const refs = useRef({ addEntryButton: undefined, addTaskButton: undefined, refreshButton: undefined, configButton: undefined });
    const raiseError = useRaise('error');

    const [tasks, setTasks] = useState([]);
    const [entries, setEntries] = useState([]);
    const [values, setValues] = useState([[], [], []]);

    const days = [...Array(settings?.numberOfDays)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState(JSON.parse(window.localStorage.getItem('draft'))); // saved in Editor on `unload` event

    const refresh = async () => {
        try {
            debugger;
            if (!functions) return;
            const { redmine } = functions;
            refs.current.refreshButton.disabled = true; // TODO: move to event handler
            // const { url, key, days } = settings;
            const results = await Promise.all([
            //     refreshEntries(url, key, days),
            //     refreshProjects(url, key),
            //     refreshIssues(url, key),
                refreshActivities(redmine)
            ]);
            // if (!results.find(res => res)) return;
            // await storage.set({ refresh: dayjs().toJSON() });
        } catch (error) {
            raiseError(error);
        } finally {
            refs.current.refreshButton.disabled = false; // TODO: move to event handler
        }
    };

    const loadTasks = async () => {

    };

    useAsyncEffect(async ({ aborted }) => { // load tasks/entries
        if (!functions) return;
        console.time('init');
        const tasks = await database.table('tasks').reverse().toArray();
        const entries = await database.table('entries').reverse().toArray();
        // const projects = await database.table('projects').toArray();
        // const issues = await database.table('issues').reverse().toArray();
        const activities = await database.table('activities').orderBy('name').toArray();
        const issueIdsInEntries = [...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))];
        const issues = await database.table('issues').where('id').anyOf(issueIdsInEntries).toArray();
        console.timeEnd('init');
        console.log(activities);
        if (aborted) return;
        setTasks(tasks); // NOTE: batched updates in React 19
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
        // setValues([projects, issues, activities]);
    }, [functions]);

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
                refs.current.addEntryButton.focus();
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
                refs.current.addEntryButton.focus();
                setEntry();
            } catch (error) {
                raiseError(error);
            }
        },
        onDuplicate: (entry) => setEntry(entry),
        onDismiss: () => setEntry() || refs.current.addEntryButton.focus()
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

    useEffect(() => refs.current.addEntryButton?.focus(), []); // focus on add entry button

    if (!settings) return null;
    return <ThemeProvider theme={theme}>
        {/* <Editor {...propsEditor} /> */}
        {config && <Config {...propsConfig} />}
        <Toaster />
        <div className={classes.base}>
            <button ref={ref => refs.current.addEntryButton = ref} title={'Add time entry'} onClick={() => setEntry({ spent_on: today })}><FiClock /></button>
            <input ref={ref => refs.current.addTaskButton = ref} {...propsAddTask} />
            <button ref={ref => refs.current.refreshButton = ref} title={'Refresh'} onClick={onRefresh}><FiRefreshCw /></button>
            <button ref={ref => refs.current.configButton = ref} title={'Configuration'} onClick={onConfig}><FiSettings /></button>
        </div>
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {/* {days.map(day => <Day {...propsDay(day)} />)} */}
    </ThemeProvider>;
};

export default App;