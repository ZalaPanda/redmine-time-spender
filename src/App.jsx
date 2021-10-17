import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Globals } from 'react-spring';
import { ThemeProvider, createUseStyles } from 'react-jss';
import { FiRefreshCw, FiClock, FiSettings } from 'react-icons/fi';

import { storage, useAsyncEffect, useRaise, useListen } from './storage.js';
import { themes } from './themes.js';
import { createKey, createCryptoApi } from './crypto.js';
import { createRedmineApi } from './redmine.js';
import { createEntryptedDatabase } from './database.js';

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

const App = () => {
    useGlobalStyles();

    /** @type {[Settings, React.Dispatch<(prevState: Settings) => Settings>]} */
    const [settings, setSettings] = useState();
    useAsyncEffect(async ({ aborted }) => { // load settings from local storage.
        const settings = await storage.get();
        if (aborted) return;
        setSettings({ ...settings });
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

    const [config, setConfig] = useState(false); // config shown/hidden
    const [redmine, setRedmine] = useState();
    const [database, setDatabase] = useState();
    useAsyncEffect(async ({ aborted }) => { // init crypto
        if (!settings) return;
        if (!settings?.redmine) return setConfig(true); // show config
        const { redmine: { baseUrl, encodedKey } } = settings;
        const { value: cryptoKey } = await cookie(baseUrl).get();
        const crypto = createCryptoApi(fromHexString(cryptoKey));
        const apiKey = crypto.decrypt(fromHexString(encodedKey));
        const redmine = createRedmineApi(baseUrl, apiKey);
        if (aborted) return;

        const database = createEntryptedDatabase(crypto);
        // const database = new Dexie('redmine-cache');
        // database.version(1).stores({
        //     projects: '++, &id, updated_on',
        //     issues: '&id, updated_on',
        //     activities: '&id, active',
        //     entries: '&id, spent_on, updated_on', // order: updated_on <desc>
        //     tasks: '++id',
        //     logs: '++'
        // });

        // /* Dexie table encryption */
        // database.tables.map(table => { // TODO: change to Dexie 3 - https://dexie.org/docs/DBCore/DBCoreTable
        //     const { schema: { primKey, indexes } } = table;
        //     const encryptedDataKey = '_data';
        //     const notEncryptedKeys = [primKey?.name, ...indexes?.map(index => index.name)].filter(name => name);
        //     // API: https://dexie.org/docs/Table/Table.hook('creating')
        //     table.hook('creating', (_, item) => {
        //         const rest = Object.fromEntries(
        //             Object.entries(item).filter(([key]) => !notEncryptedKeys.includes(key) && delete item[key])); // !!delete === true (wow!)
        //         item[encryptedDataKey] = crypto.encrypt(rest);
        //     });
        //     // API: https://dexie.org/docs/Table/Table.hook('updating')
        //     table.hook('updating', (modifications, _, item) => {
        //         if (!Object.keys(modifications).find(key => !notEncryptedKeys.includes(key))) return; // only keys updated
        //         const encryptedDataValue = item[encryptedDataKey];
        //         const updated = { ...item, ...encryptedDataValue && crypto.decrypt(encryptedDataValue), ...modifications };
        //         const keys = Object.fromEntries(
        //             Object.entries(modifications).filter(([key]) => notEncryptedKeys.includes(key)));
        //         const rest = Object.fromEntries(
        //             Object.entries(updated).filter(([key]) => key !== encryptedDataKey && !notEncryptedKeys.includes(key)));
        //         return { ...keys, [encryptedDataKey]: crypto.encrypt(rest) };
        //     });
        //     // API: https://dexie.org/docs/Table/Table.hook('reading')
        //     table.hook('reading', (item) => {
        //         if (!item.hasOwnProperty(encryptedDataKey)) return item;
        //         const encryptedDataValue = item[encryptedDataKey];
        //         const rest = Object.fromEntries(
        //             Object.entries(item).filter(([key]) => key !== encryptedDataKey));
        //         return { ...rest, ...encryptedDataValue && crypto.decrypt(encryptedDataValue) };
        //     });
        // });
        await database.open();

        setDatabase(database);
        setRedmine(redmine);
    }, [settings?.redmine]);

    const loadTasks = async ({ aborted }) => {
        if (!database) return;
        // const tasks = await database.table('tasks').toArray();
        const tasks = await database.table('tasks').reverse().toArray();
        if (aborted) return;
        setTasks(tasks);
    };
    useAsyncEffect(loadTasks, [database]);

    const loadEntries = async ({ aborted }) => {
        if (!database) return;
        const entries = await database.table('entries').reverse().toArray();
        const issueIdsInEntries = [...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))];
        const issues = await database.table('issues').where('id').anyOf(issueIdsInEntries).toArray();
        if (aborted) return;
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
    };
    useAsyncEffect(loadEntries, [database]);

    const loadLists = async ({ aborted }) => { // load projects/issues/activities after load
        if (!database) return;
        const projects = await database.table('projects').toArray();
        const issues = await database.table('issues').reverse().toArray();
        const unsortedActivities = await database.table('activities').toArray();
        const activities = unsortedActivities.sort((a, b) => a.name.localeCompare(b.name));
        if (aborted) return;
        setLists([projects, issues, activities]);
    };
    useAsyncEffect(loadLists, [database]);

    const refs = useRef({ addEntryButton: undefined, addTaskInput: undefined, refreshButton: undefined, configButton: undefined });
    const raiseError = useRaise('error');

    const [tasks, setTasks] = useState([]);
    const [entries, setEntries] = useState([]);
    const [lists, setLists] = useState([[], [], []]);

    const days = [...Array(settings?.numberOfDays)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState(JSON.parse(window.localStorage.getItem('draft'))); // saved in Editor on `unload` event

    const filteredTasks = useMemo(() => tasks.filter(({ closed_on }) => !closed_on || dayjs(today).isSame(closed_on, 'day')), [tasks, today]);
    const filteredEntries = useMemo(() => entries.reduce((entries, entry) => ({ ...entries, [entry.spent_on]: [...entries[entry.spent_on] || [], entry] }), {}), [entries]);

    const refresh = async () => {
        const refreshEntries = async () => {
            const { numberOfDays } = settings;
            const fromDay = dayjs().subtract(numberOfDays, 'day').format('YYYY-MM-DD');
            await database.table('entries').where('spent_on').below(fromDay).delete(); // remove old entries
            const last = await database.table('entries').orderBy('updated_on').last() || {};
            const entries = await redmine.getEntries(fromDay);
            if (last?.updated_on && !entries.find(entry => entry.updated_on > last.updated_on)) return;
            return await database.table('entries').bulkPut(entries);
        };
        const refreshProjects = async () => {
            const last = await database.table('projects').orderBy('updated_on').last() || {};
            const projects = await redmine.getProjects();
            if (last?.updated_on && !projects.find(project => project.updated_on > last.updated_on)) return;
            await database.table('projects').clear();
            return await database.table('projects').bulkAdd(projects);
        };
        const refreshIssues = async () => {
            const last = await database.table('issues').orderBy('updated_on').last() || {};
            const issues = await redmine.getIssues(last?.updated_on);
            if (last?.updated_on && !issues.find(issue => issue.updated_on > last.updated_on)) return;
            return await database.table('issues').bulkPut(issues);
        };
        const refreshActivities = async () => {
            const activities = await redmine.getActivities();
            await database.table('activities').bulkPut(activities);
        };
        try {
            refs.current.refreshButton.disabled = true; // TODO: move to event handler
            const [changedEntries, ...changedValues] = await Promise.all([
                refreshEntries(),
                refreshProjects(),
                refreshIssues(),
                refreshActivities()
            ]);
            debugger;
            if (changedEntries) loadEntries({});
            // if (changedValues.find(value => value)) loadLists({});
            loadLists({});
        } catch (error) {
            raiseError(error);
        } finally {
            refs.current.refreshButton.disabled = false; // TODO: move to event handler
        }
    };

    const propsAddEntryButton = ({
        ref: ref => refs.current.addEntryButton = ref, title: 'Add time entry',
        onClick: _ => setEntry({ spent_on: today })
    });

    const propsAddTask = ({
        ref: ref => refs.current.addTaskInput = ref, placeholder: 'Add task',
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

    const propsRefreshButton = ({
        ref: ref => refs.current.refreshButton = ref, title: 'Refresh',
        onClick: refresh
    });

    const propsConfigButton = ({
        ref: ref => refs.current.configButton = ref, title: 'Configuration',
        onClick: _ => setConfig(true)
    });

    const propsEditor = ({
        entry, lists, baseUrl: settings?.redmine?.baseUrl,
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

    const propsConfig = {
        settings, onRefresh: refresh, onDismiss: () => setConfig(false)
    };

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

    const propsDay = (day) => ({
        day, key: day, selected: day === today, entries: filteredEntries[day] || [], workHours: settings?.workHours, baseUrl: settings?.redmine?.baseUrl,
        onSelectDay: () => setToday(day === today ? undefined : day),
        onSelectEntry: (entry) => () => setEntry(entry)
    });

    useEffect(() => refs.current.addEntryButton?.focus(), []); // focus on add entry button

    const test = async () => {
        const projects1 = await database.table('projects').where('id').anyOf([630, 631, 632]).toArray();
        const projects2 = await database.table('projects').reverse().toArray();
        const projects3 = await database.table('projects').toArray();
        console.log(projects1, projects2, projects3);
    }

    if (!settings) return null;
    return <ThemeProvider theme={theme}>
        <Editor {...propsEditor} />
        {config && <Config {...propsConfig} />}
        <Toaster />
        <div className={classes.base}>
            <button {...propsAddEntryButton}><FiClock /></button>
            <input {...propsAddTask} />
            <button {...propsRefreshButton}><FiRefreshCw /></button>
            <button {...propsConfigButton}><FiSettings /></button>
            <button onClick={test}>FCK</button>
        </div>
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {days.map(day => <Day {...propsDay(day)} />)}
    </ThemeProvider>;
};

export default App;