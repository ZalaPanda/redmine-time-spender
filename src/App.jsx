import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Globals } from '@react-spring/web';
import { ThemeProvider, createUseStyles } from 'react-jss';
import { FiRefreshCw, FiClock, FiSettings, FiCoffee } from 'react-icons/fi';
// import { loremIpsum } from 'lorem-ipsum';

import { themes } from './themes.js';
import { createKey, createCryptoApi, convertHexToBin, convertBinToHex } from './crypto.js';
import { createRedmineApi } from './redmine.js';
import { createEntryptedDatabase } from './database.js';
import { useAsyncEffect, useRaise } from './uses.js';

import dayjs from 'dayjs';

import { Editor } from './Editor.jsx';
import { Day } from './Day.jsx';
import { Task } from './Task.jsx';
import { Config } from './Config.jsx';
import { Toaster } from './Toaster.jsx';
import { Bar } from './Bar.jsx';

const useGlobalStyles = createUseStyles({
    '@font-face': [{
        fontFamily: 'WorkSans',
        src: 'url("font/work-sans-v11-latin-500.woff2") format("woff2")',
    }, {
        fontFamily: 'WorkSans',
        fontWeight: 'bold',
        src: 'url("font/work-sans-v11-latin-700.woff2") format("woff2")',
    }],
    '@global': {
        '*': { fontSize: 16, fontFamily: ['WorkSans', 'Verdana', 'sans-serif'] },
        'html': { scrollBehavior: 'smooth' },
        'body': { width: 460, minHeight: 400, margin: 4 },
        'input, textarea, button': {
            color: 'unset', backgroundColor: 'transparent',
            border: 'none', margin: 1, padding: [4, 6], boxSizing: 'border-box', resize: 'none',
            '&:focus': { outline: 'none' },
            '&:disabled': { filter: 'opacity(0.6)', cursor: 'auto' }
        },
        'button': {
            textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', borderRadius: 4
        },
        'a': {
            fontWeight: 'bold', color: 'unset', textDecoration: 'none',
            '&:visited': { color: 'unset' },
            '&:hover, &:focus': { textDecoration: 'underline' }
        },
        'svg': { margin: 2, verticalAlign: 'middle', strokeWidth: 2.5 },
        // [scrollbar] https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, border: [2, 'solid', 'currentcolor'] },
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
        '*': { lineHeight: theme.lineHeight },
        'html': { backgroundColor: theme.bg, color: theme.text },
        'button': {
            '&:hover, &:focus': { backgroundColor: theme.button.hover },
            '&:active': { backgroundColor: theme.button.active }
        },
        // [selection]
        '::selection': { backgroundColor: theme.mark },
        // [scrollbar]
        '::-webkit-scrollbar-thumb': { borderColor: theme.bg, backgroundColor: theme.mark },
    },
    app: {
        display: 'flex', backgroundColor: theme.mark, padding: 2, borderRadius: 4, marginBottom: 4,
        '&>input': { flexGrow: 1 }
    }
}));

const storage = {
    get: keys => new Promise((resolve, reject) => chrome.storage.local.get(keys, items => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(items))),
    set: items => new Promise((resolve, reject) => chrome.storage.local.set(items, _ => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve())),
    remove: keys => new Promise((resolve, reject) => chrome.storage.local.remove(keys, _ => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve())),
    clear: _ => new Promise((resolve, reject) => chrome.storage.local.clear(_ => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()))
};

const cookieName = '_redmine_time_spender';
const cookie = (url) => ({
    get: _ => new Promise((resolve, reject) => chrome.cookies.get({
        name: cookieName, url
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    set: value => new Promise((resolve, reject) => chrome.cookies.set({
        name: cookieName, value, url, httpOnly: true, secure: true, expirationDate: 2147483647
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    remove: _ => new Promise((resolve, reject) => chrome.cookies.remove({
        name: cookieName, url
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    permission: {
        request: _ => new Promise((resolve, reject) => chrome.permissions.request({
            permissions: ['cookies'], origins: [new URL(url).href]
        }, granted => granted ? resolve() : reject('Request denied!'))),
        contains: _ => new Promise((resolve) => chrome.permissions.contains({
            permissions: ['cookies'], origins: [new URL(url).href]
        }, resolve)),
        remove: _ => new Promise((resolve) => chrome.permissions.remove({
            permissions: ['cookies'], origins: [new URL(url).href]
        }, resolve))
    }
});

/** @type {Settings} */
const defaultSettings = {
    redmine: undefined,
    theme: { isDark: true, lineHeight: 1.6 },
    numberOfDays: 7,
    workHours: [8, 16],
    skipAnimation: false
};

const App = () => {
    useGlobalStyles();

    const refs = useRef({ addEntryButton: undefined, addTaskInput: undefined, refreshButton: undefined, configButton: undefined });
    const raiseError = useRaise('error');

    const [config, setConfig] = useState(false); // config dialog shown/hidden
    /** @type {[Settings, React.Dispatch<(prevState: Settings) => Settings>]} */
    const [settings, setSettings] = useState();
    useAsyncEffect(async ({ aborted }) => { // load settings from local storage
        const settings = await storage.get();
        if (aborted) return;
        setSettings({ ...defaultSettings, ...settings });
        setConfig(!settings?.redmine); // open config dialog
    }, []);

    /** @type {[Theme, React.Dispatch<(prevState: Theme) => Theme>]} */
    const [theme, setTheme] = useState({ ...themes['dark'], lineHeight: 1.6 });
    const classes = useThemedStyles({ theme });

    useEffect(() => { // update theme
        if (!settings?.theme) return;
        const { theme: { isDark, lineHeight } } = settings;
        setTheme({ ...themes[isDark ? 'dark' : 'light'], lineHeight })
    }, [settings?.theme]);

    useEffect(() => { // spring animations on/off
        if (!settings) return;
        const { skipAnimation } = settings;
        Globals.assign({ skipAnimation });
    }, [settings?.skipAnimation]);

    /** @type {[RedmineAPI, React.Dispatch<(prevState: RedmineAPI) => RedmineAPI>]} */
    const [redmine, setRedmine] = useState(); // Redmine API
    /** @type {[Dexie.Database, React.Dispatch<(prevState: Dexie.Database) => Dexie.Database>]} */
    const [database, setDatabase] = useState(); // IndexedDb API

    const [tasks, setTasks] = useState([]); // todo list items
    const [entries, setEntries] = useState([]); // Redmine time entries
    const [lists, setLists] = useState([[], [], []]); // projects, issues, activities

    const days = [...Array(settings?.numberOfDays)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState(JSON.parse(window.localStorage.getItem('draft'))); // saved in Editor on `unload` event

    const filteredTasks = useMemo(() => tasks.filter(({ closed_on }) => !closed_on || dayjs(today).isSame(closed_on, 'day')), [tasks, today]);
    const filteredEntries = useMemo(() => entries.reduce((entries, entry) => ({ ...entries, [entry.spent_on]: [...entries[entry.spent_on] || [], entry] }), {}), [entries]);

    useAsyncEffect(async ({ aborted }) => { // init redmine and database with cookie key
        if (!settings?.redmine) return;
        const { redmine: { baseUrl, encodedKey } } = settings;
        const { value: cryptoKey } = await cookie(baseUrl).get();
        const crypto = createCryptoApi(convertHexToBin(cryptoKey));
        const apiKey = crypto.decrypt(convertHexToBin(encodedKey));
        const redmine = createRedmineApi(baseUrl, apiKey);
        const database = createEntryptedDatabase(crypto);
        await database.open();
        if (aborted) return;
        setRedmine(redmine);
        setDatabase(database);
    }, [settings?.redmine]);

    const loadTasks = async ({ aborted }) => {
        const tasks = await database.table('tasks').reverse().toArray();
        if (aborted) return;
        setTasks(tasks);
    };
    const loadEntries = async ({ aborted }) => {
        const entries = await database.table('entries').reverse().toArray();
        const issueIdsInEntries = [...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))];
        const issues = await database.table('issues').where('id').anyOf(issueIdsInEntries).toArray();
        if (aborted) return;
        setEntries(entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })));
    };
    const loadLists = async ({ aborted }) => { // load projects/issues/activities after load
        const projects = await database.table('projects').toArray();
        const issues = await database.table('issues').reverse().toArray();
        const unsortedActivities = await database.table('activities').toArray();
        const activities = unsortedActivities.sort((a, b) => a.name.localeCompare(b.name));
        if (aborted) return;
        setLists([projects, issues, activities]);
    };
    useAsyncEffect(async ({ aborted }) => {
        if (!database) return;
        await loadTasks({ aborted });
        await loadEntries({ aborted });
        await loadLists({ aborted });
    }, [database]);

    const propsAddEntryButton = ({
        ref: ref => refs.current.addEntryButton = ref, title: 'Add time entry',
        onClick: _ => setEntry({ spent_on: today })
    });

    const propsAddTaskInput = ({
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
        onClick: async () => {
            const refreshEntries = async () => {
                const { numberOfDays } = settings;
                const fromDay = dayjs().subtract(numberOfDays, 'day').format('YYYY-MM-DD');
                await database.table('entries').where('spent_on').below(fromDay).delete(); // remove old entries
                const count = await database.table('entries').count();
                const last = await database.table('entries').orderBy('updated_on').last();
                const entries = await redmine.getEntries(fromDay);
                if (count === entries.length && last?.updated_on && !entries.find(entry => entry.updated_on > last.updated_on)) return; // nothing changed
                await database.table('entries').where('id').noneOf(entries.map(entry => entry.id)).delete(); // remove unknown entries
                return await database.table('entries').bulkPut(entries);
            };
            const refreshProjects = async () => {
                const count = await database.table('entries').count();
                const last = await database.table('projects').orderBy('updated_on').last();
                const projects = await redmine.getProjects();
                if (count === entries.length && last?.updated_on && !projects.find(project => project.updated_on > last.updated_on)) return;
                await database.table('projects').clear();
                return await database.table('projects').bulkAdd(projects);
            };
            const refreshIssues = async () => {
                const last = await database.table('issues').orderBy('updated_on').last();
                const issues = await redmine.getIssues(last?.updated_on);
                if (last?.updated_on && !issues.find(issue => issue.updated_on > last.updated_on)) return;
                return await database.table('issues').bulkPut(issues);
            };
            const refreshActivities = async () => {
                const activities = await redmine.getActivities();
                await database.table('activities').where('id').noneOf(activities.map(activity => activity.id)).delete(); // remove unknown activities
                await database.table('activities').bulkPut(activities);
            };
            try {
                refs.current.refreshButton.disabled = true;
                const [changedEntries, ...changedValues] = await Promise.all([
                    refreshEntries(),
                    refreshProjects(),
                    refreshIssues(),
                    refreshActivities()
                ]);
                if (changedEntries) loadEntries({});
                if (changedValues.find(value => value)) loadLists({});
            } catch (error) {
                raiseError(error);
            } finally {
                refs.current.refreshButton.disabled = false;
                refs.current.refreshButton.focus();
            }
        }
    });

    const propsConfigButton = ({
        ref: ref => refs.current.configButton = ref, title: 'Configuration',
        onClick: _ => setConfig(true)
    });

    // const propsCipherButton = ({
    //     title: 'Lorem ipsum strings',
    //     onClick: event => {
    //         const sentence = _ => loremIpsum({ units: 'sentence', count: 1 });
    //         const capitalize = ([first, ...rest]) => first.toUpperCase() + rest.join('').toLowerCase();
    //         const words = count => capitalize(loremIpsum({ units: 'words', count: Math.floor(Math.random() * count) + 1 }));
    //         // setTasks(tasks => tasks.map(task => ({ // not working
    //         //     ...task,
    //         //     value: sentence()
    //         // })));
    //         setEntries(entries => entries.map(entry => ({
    //             ...entry,
    //             project: { ...entry.project, name: words(3) },
    //             activity: { ...entry.activity, name: words(1) },
    //             issue: entry.issue && { ...entry.issue, subject: words(5) },
    //             comments: sentence()
    //         })));
    //         setLists(([projects, issues, activities]) => [
    //             projects.map(project => ({ ...project, name: words(3) })),
    //             issues.map(issue => ({ ...issue, subject: words(5), description: sentence(), project: issue.project && { ...issue.project, name: words(3) } })),
    //             activities.map(activity => ({ ...activity, name: words(1) })),
    //         ]);
    //         event.currentTarget.setAttribute('hidden', true);
    //     }
    // });

    const propsEditor = ({
        entry, lists, baseUrl: settings?.redmine?.baseUrl,
        onSubmit: async ({ id, project, issue, hours, activity, comments, spent_on }) => {
            try {
                if (id) { // update
                    await redmine.updateEntry({ id, project, issue, hours, activity, comments, spent_on }); // 204 No Content: time entry was updated
                    const update = { // NOTE: `updated_on` not updated
                        ...project && { project: { id: project.id, name: project.name } },
                        ...issue && { issue: { id: issue.id } },
                        ...activity && { activity: { id: activity.id, name: activity.name } },
                        hours, comments, spent_on
                    };
                    await database.table('entries').update(id, update);
                    setEntries(entries => entries.map(entry => entry.id === id ? { ...entry, ...update, issue } : entry));
                } else { // create
                    const response = await redmine.createEntry({ project, issue, hours, activity, comments, spent_on });
                    const { time_entry: entry } = await response.json();
                    await database.table('entries').put(entry);
                    setEntries(entries => [{ ...entry, issue }, ...entries]);
                }
                setEntry();
                refs.current.addEntryButton.focus();
            } catch (error) {
                raiseError(error);
            }
        },
        onDelete: async ({ id }) => {
            try {
                await redmine.deleteEntry({ id });
                await database.table('entries').delete(id);
                setEntries(entries => entries.filter(entry => entry.id !== id));
                setEntry();
                refs.current.addEntryButton.focus();
            } catch (error) {
                raiseError(error);
            }
        },
        onDuplicate: (entry) => setEntry(entry),
        onDismiss: () => setEntry() || refs.current.addEntryButton.focus()
    });

    const propsConfig = {
        settings,
        onChange: async (changes) => {
            try {
                await storage.set(changes);
                setSettings(settings => ({ ...settings, ...changes }));
            } catch (error) {
                raiseError(error);
            }
        },
        onSetup: async (baseUrl, apiKey) => {
            try {
                const result = await cookie(baseUrl).permission.contains(); // check permission to redmine cookies
                if (!result) await cookie(baseUrl).permission.request(); // request permission
                const redmine = createRedmineApi(baseUrl, apiKey);
                await redmine.getUser(); // check URL and API key
                const cryptoKey = createKey(); // generate new crypto key
                await cookie(baseUrl).set(convertBinToHex(cryptoKey)); // save crypto key in cookie
                const crypto = createCryptoApi(cryptoKey);
                const encodedKey = convertBinToHex(crypto.encrypt(apiKey)); // encrypt API key
                await storage.set({ redmine: { baseUrl, encodedKey } }); // save URL and encoded API key
                setSettings(settings => ({ ...settings, redmine: { baseUrl, encodedKey } }));
            } catch (error) {
                raiseError(error);
            }
        },
        onReset: async (baseUrl) => {
            try {
                await cookie(baseUrl).permission.remove(); // remove permission to redmine cookies
                database && Promise.all([ // purge everything from database
                    database.table('projects').clear(),
                    database.table('issues').clear(),
                    database.table('activities').clear(),
                    database.table('entries').clear(),
                    database.table('tasks').clear() // TODO: transfer tasks?
                ]);
                await storage.remove('redmine');
                setSettings(({ redmine, ...settings }) => settings);
            } catch (error) {
                raiseError(error);
            }
        },
        onDismiss: () => setConfig(false)
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
    return <ThemeProvider theme={theme}>
        <Editor {...propsEditor} />
        {config && <Config {...propsConfig} />}
        <Toaster />
        <div className={classes.app}>
            <button {...propsAddEntryButton}><FiClock /></button>
            <input {...propsAddTaskInput} />
            <button {...propsRefreshButton}><FiRefreshCw /></button>
            <button {...propsConfigButton}><FiSettings /></button>
            {/* <button {...propsCipherButton}><FiCoffee /></button> */}
        </div>
        <Bar />
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {days.map(day => <Day {...propsDay(day)} />)}
    </ThemeProvider>;
};

export default App;