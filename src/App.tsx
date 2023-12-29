import { useState, useEffect, useMemo, useRef, startTransition, KeyboardEvent, MouseEvent } from 'react';
import { Globals } from '@react-spring/web';
import { FiRefreshCw, FiClock, FiSettings, FiHome, FiHash } from 'react-icons/fi';
import { css, Theme, ThemeProvider, Global } from '@emotion/react';
import { margin } from 'polished';
// import { loremIpsum } from 'lorem-ipsum';

import { globalStyles, themes } from './themes';
import { createCryptoApi, convertHexToBin } from './apis/crypto';
import { Activity, createRedmineApi, Entry, EntryExt, Issue, IssueExt, Priority, Project, RedmineAPI, Status } from './apis/redmine';
import { createEntryptedDatabase } from './apis/database';
import { useAsyncEffect, useRaise } from './apis/uses';

import dayjs from 'dayjs';

import { EditEntry } from './EditEntry';
import { EditIssue } from './EditIssue';
import { Day } from './Day';
import { EditTask, Task } from './EditTask';
import { Toaster } from './Toaster';
import { Bar } from './Bar';
import { Database } from 'dexie';

const appStyles = (theme: Theme) => css([
    globalStyles(theme),
    { 'body': { width: 460, minHeight: 380, ...margin(10, 8) } }
]);

const titleStyles = (theme: Theme) => css({
    display: 'flex', backgroundColor: theme.mark, padding: 2, borderRadius: 4, marginBottom: 4,
    '&>button[active]': { backgroundColor: theme.button.active },
    '&>input': { flexGrow: 1 }
})

export const storage = {
    get: (keys?: string[]) => new Promise((resolve, reject) => chrome.storage.local.get(keys, items => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(items))),
    set: (items: { [key: string]: any }) => new Promise((resolve, reject) => chrome.storage.local.set(items, () => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(undefined))),
    remove: (keys?: string | string[]) => new Promise((resolve, reject) => chrome.storage.local.remove(keys, () => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(undefined))),
    clear: () => new Promise((resolve, reject) => chrome.storage.local.clear(() => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(undefined)))
};

const cookieName = '_redmine_time_spender';
export const cookie = (url: string) => ({
    get: () => new Promise<chrome.cookies.Cookie>((resolve, reject) => chrome.cookies.get({
        name: cookieName, url
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    set: (value: string | undefined) => new Promise<chrome.cookies.Cookie>((resolve, reject) => chrome.cookies.set({
        name: cookieName, value, url, httpOnly: true, secure: true, expirationDate: 2147483647
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    remove: () => new Promise<chrome.cookies.Details>((resolve, reject) => chrome.cookies.remove({
        name: cookieName, url
    }, cookie => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(cookie))),
    permission: {
        request: () => new Promise<void>((resolve, reject) => chrome.permissions.request({
            permissions: ['cookies'], origins: [new URL(url).href]
        }, granted => granted ? resolve() : reject('Request denied!'))),
        contains: () => new Promise<boolean>((resolve) => chrome.permissions.contains({
            permissions: ['cookies'], origins: [new URL(url).href]
        }, resolve)),
        remove: () => new Promise<boolean>((resolve) => chrome.permissions.remove({
            permissions: ['cookies']
        }, resolve))
    }
});

export type Lists = {
    projects: Project[],
    issues: Issue[],
    activities: Activity[],
    priorities: Priority[],
    statuses: Status[]
};

export type Favorites = {
    [key in 'projects' | 'trackers' | 'issues' | 'activities' | 'statuses' | 'priorities' | 'categories']: number[];
};

/** User settings stored in `chrome.storage.local` */
export type Settings = {
    redmine?: { baseUrl: string, encodedKey: string },
    theme?: { isDark: boolean, lineHeight: number },
    numberOfDays: number,
    workHours: [start: number, end: number],
    hoursStep: number,
    autoRefresh?: false | 'hour' | 'day',
    lastRefresh?: string,
    skipAnimation: boolean,
    hideInactive: { issues: boolean, activities: boolean, priorities: boolean },
    favorites?: Favorites
};

export const defaultSettings: Settings = {
    redmine: undefined,
    theme: { isDark: true, lineHeight: 1.6 },
    numberOfDays: 14,
    workHours: [8, 16],
    hoursStep: 0.25,
    autoRefresh: false,
    skipAnimation: false,
    hideInactive: { issues: false, activities: false, priorities: false }
};

const drafts = {
    entry: JSON.parse(window.localStorage.getItem('draft-entry')), // saved in EditEntry in a useEffect
    issue: JSON.parse(window.localStorage.getItem('draft-issue'))  // saved in EditIssue in a useEffect
};

export const App = () => {
    const refs = useRef({
        addIssueButton: undefined as HTMLButtonElement,
        addEntryButton: undefined as HTMLButtonElement,
        refreshButton: undefined as HTMLButtonElement,
        searchInput: undefined as HTMLInputElement
    });
    const raiseNotice = useRaise('notice');
    const raiseError = useRaise('error');

    const [settings, setSettings] = useState<Settings>();
    useAsyncEffect(async ({ aborted }) => { // load settings from local storage
        const settings = await storage.get() as Settings;
        if (aborted) return;
        setSettings({ ...defaultSettings, ...settings });
        if (settings?.redmine) return;
        chrome.runtime.openOptionsPage();
    }, []);

    const [theme, setTheme] = useState<Theme>({ ...themes['dark'], lineHeight: 1.6 });
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

    const [redmine, setRedmine] = useState<RedmineAPI>(); // Redmine API
    const [database, setDatabase] = useState<Database>(); // IndexedDb API

    const [tasks, setTasks] = useState<Task[]>([]); // todo list items
    const [lists, setLists] = useState<Lists>({ projects: [], issues: [], activities: [], priorities: [], statuses: [] }); // other Redmine types
    const [entries, setEntries] = useState<EntryExt[]>([]); // Redmine time entries

    const days = [...Array(settings?.numberOfDays)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD'));
    const [search, setSearch] = useState<string | undefined>();
    const searching = search !== undefined;
    const [today, setToday] = useState(days[0]);
    const [entry, setEntry] = useState<Partial<EntryExt> | undefined>();
    const [issue, setIssue] = useState<Partial<IssueExt> | undefined>();

    const filteredTasks = useMemo(() => {
        const exp = searching && RegExp((search || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') || null;
        return tasks.filter(({ value, closed_on }) => exp ? exp.test(value) : !closed_on || dayjs(today).isSame(closed_on, 'day'));
    }, [tasks, today, search, searching]);
    const filteredEntries = useMemo(() => {
        const exp = searching && RegExp((search || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') || null;
        return entries
            .filter(({ project, issue, activity, comments }) => !exp || exp.test(comments) || exp.test(project?.name) || exp.test(issue?.subject) || exp.test(String(issue?.id)) || exp.test(activity?.name))
            .reduce((entries, entry) => ({ ...entries, [entry.spent_on]: [...entries[entry.spent_on] || [], entry] }), {})
    }, [entries, search, searching]);

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
        const { autoRefresh, lastRefresh } = settings; // handle auto refresh
        if (!autoRefresh) return;
        if (await database.table('activities').count() && autoRefresh && lastRefresh && dayjs().isSame(dayjs(lastRefresh), autoRefresh)) return;
        refs.current.refreshButton.click();
    }, [settings?.redmine]);

    const loadTasks = async ({ aborted }) => {
        const tasks = await database.table('tasks').reverse().toArray();
        if (aborted) return;
        startTransition(() => setTasks(tasks));
    };
    const loadEntries = async ({ aborted }) => {
        const entries = await database.table('entries').reverse().toArray() as Entry[];
        const related = {
            projectIds: entries.filter(entry => entry.project).map(entry => entry.project.id).filter((id, index, array) => array.indexOf(id) === index),
            issueIds: entries.filter(entry => entry.issue).map(entry => entry.issue.id).filter((id, index, array) => array.indexOf(id) === index),
            activityIds: entries.filter(entry => entry.activity).map(entry => entry.activity.id).filter((id, index, array) => array.indexOf(id) === index)
        };
        const [projects, issues, activities] = await Promise.all([
            database.table('projects').where('id').anyOf(related.projectIds).toArray() as Promise<Project[]>,
            database.table('issues').where('id').anyOf(related.issueIds).toArray() as Promise<Issue[]>,
            database.table('activities').where('id').anyOf(related.activityIds).toArray() as Promise<Activity[]>
        ]);
        if (aborted) return;
        startTransition(() => setEntries(entries.map(entry => ({
            ...entry,
            project: entry.project && projects.find(project => project.id === entry.project.id),
            issue: entry.issue && issues.find(issue => issue.id === entry.issue.id),
            activity: entry.activity && activities.find(activity => activity.id === entry.activity.id),
        }))));
    };
    const loadLists = async ({ aborted }) => { // load projects/issues/priorities/statuses after load
        const [projects, issues, activities, priorities, statuses] = await Promise.all([
            database.table('projects').toArray() as Promise<Project[]>,
            database.table('issues').reverse().toArray() as Promise<Issue[]>,
            database.table('activities').toCollection().sortBy('name') as Promise<Activity[]>,
            database.table('priorities').toArray() as Promise<Priority[]>,
            database.table('statuses').toArray() as Promise<Status[]>
        ]);
        if (aborted) return;
        startTransition(() => {
            setLists({ projects, issues, activities, priorities, statuses });
            setEntry(drafts.entry);
            setIssue(drafts.issue);
        });
    };
    useAsyncEffect(async ({ aborted }) => {
        if (!database) return;
        loadTasks({ aborted });
        loadEntries({ aborted });
        loadLists({ aborted });
    }, [database]);

    const propsTitle = ({
        css: titleStyles,
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            const { defaultPrevented, key, ctrlKey } = event;
            if (defaultPrevented) return;
            if (ctrlKey && key === 'f') { // turn on search mode
                setSearch('');
                return event.preventDefault();
            }
            if (searching && (key === 'Escape' || key === 'Esc')) { // turn off search mode
                setSearch(undefined);
                return event.preventDefault();
            }
        }
    });

    const propsAddIssueButton = ({
        ref: (ref: HTMLButtonElement) => refs.current.addIssueButton = ref,
        title: 'Add issue',
        onClick: () => setIssue({ assigned_to: { id: 0, name: 'me' }, start_date: today })
    });

    const propsAddEntryButton = ({
        ref: (ref: HTMLButtonElement) => refs.current.addEntryButton = ref,
        title: 'Add time entry',
        onClick: () => setEntry({ spent_on: today })
    });

    const propsAddTaskInput = ({
        placeholder: 'Add task', hidden: searching,
        onKeyDown: async (event: KeyboardEvent<HTMLInputElement>) => {
            const { defaultPrevented, key, currentTarget: target } = event;
            if (defaultPrevented) return;
            const { value } = target;
            if (key === 'Enter') {
                const props = { value, created_on: dayjs().toJSON() };
                const id = await database.table('tasks').add(props);
                const task = { id, ...props } as Task;
                setTasks(tasks => [task, ...tasks]);
                target.value = '';
            }
        }
    });

    const propsSearchInput = ({
        ref: (ref: HTMLInputElement) => refs.current.searchInput = ref,
        placeholder: 'Search', hidden: !searching,
        onChange: (event) => startTransition(() => setSearch(event.target.value))
    });

    const propsHomeButton = ({
        title: settings?.redmine?.baseUrl, disabled: !settings,
        onClick: () => {
            const url = settings?.redmine?.baseUrl;
            chrome.tabs.create({ url });
        }
    });

    const propsRefreshButton = ({
        ref: (ref: HTMLButtonElement) => refs.current.refreshButton = ref,
        title: 'Refresh',
        onClick: async () => {
            const refreshEntries = async () => {
                const { numberOfDays } = settings;
                const fromDay = dayjs().subtract(numberOfDays, 'day').format('YYYY-MM-DD');
                const [_, count, last, entries] = await Promise.all([
                    database.table('entries').where('spent_on').below(fromDay).delete(), // remove old entries
                    database.table('entries').count(),
                    database.table('entries').orderBy('updated_on').last(),
                    redmine.getEntries(fromDay)
                ]);
                if (count === entries.length && last?.updated_on && !entries.find(entry => entry.updated_on > last.updated_on)) return; // nothing changed
                await database.table('entries').where('id').noneOf(entries.map(entry => entry.id)).delete(); // remove unknown entries
                return await database.table('entries').bulkPut(entries);
            };
            const refreshProjects = async () => {
                const [count, last, projects] = await Promise.all([
                    database.table('projects').count(),
                    database.table('projects').orderBy('updated_on').last(),
                    redmine.getProjects()
                ]);
                if (count === projects.length && last?.updated_on && !projects.find(project => project.updated_on > last.updated_on)) return;
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
                await database.table('activities').where('id').noneOf(activities.map(activity => activity.id)).delete(); // remove unknown
                await database.table('activities').bulkPut(activities);
            };
            const refreshPriorities = async () => {
                const priorities = await redmine.getPriorities();
                await database.table('priorities').where('id').noneOf(priorities.map(priority => priority.id)).delete(); // remove unknown
                await database.table('priorities').bulkPut(priorities);
            };
            const refreshStatuses = async () => {
                const statuses = await redmine.getStatuses();
                await database.table('statuses').where('id').noneOf(statuses.map(status => status.id)).delete(); // remove unknown
                await database.table('statuses').bulkPut(statuses);
            };
            try {
                refs.current.refreshButton.disabled = true;
                const [changedEntries, ...changedValues] = await Promise.all([
                    refreshEntries(),
                    refreshProjects(),
                    refreshIssues(),
                    refreshActivities(),
                    refreshPriorities(),
                    refreshStatuses()
                ]);
                if (changedEntries) loadEntries({ aborted: false });
                if (changedValues.find(value => value)) loadLists({ aborted: false });
                await storage.set({ lastRefresh: dayjs().toJSON() }); // save last refresh date
            } catch (error) {
                raiseError(error);
            } finally {
                refs.current.refreshButton.disabled = false;
                refs.current.refreshButton.focus();
            }
        }
    });

    const propsOptionsButton = ({
        title: 'Options',
        onClick: () => chrome.runtime.openOptionsPage()
    });

    // const propsCipherButton = ({
    //     title: 'Lorem ipsum strings',
    //     onClick: (event: MouseEvent<HTMLButtonElement>) => {
    //         const sentence = () => loremIpsum({ units: 'sentence', count: 1 });
    //         const capitalize = ([first, ...rest]) => first.toUpperCase() + rest.join('').toLowerCase();
    //         const words = (count: number) => capitalize(loremIpsum({ units: 'words', count: Math.floor(Math.random() * count) + 1 }));
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
    //         setLists(({ projects, issues, activities }) => [
    //             projects.map(project => ({ ...project, name: words(3) })),
    //             issues.map(issue => ({ ...issue, subject: words(5), description: sentence(), project: issue.project && { ...issue.project, name: words(3) } })),
    //             activities.map(activity => ({ ...activity, name: words(1) })),
    //         ]);
    //         event.currentTarget.setAttribute('hidden', true);
    //     }
    // });

    const propsLink = (url: string) => ({
        href: url, target: '_blank', tabIndex: -1,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            chrome.tabs.create({ url, active: false });
        }
    });

    const propsEditEntry = ({
        show: !!entry, entry, lists, baseUrl: settings?.redmine?.baseUrl, favorites: settings?.favorites, hideInactive: settings?.hideInactive, hourStep:settings?.hoursStep,
        onSubmit: async (entry: Partial<EntryExt>) => {
            try {
                const { id, project, issue, hours, activity, comments, spent_on } = entry;
                if (id) { // update
                    await redmine.updateEntry(entry); // 204 No Content: time entry was updated
                    const update = { // NOTE: `updated_on` not updated
                        ...project && { project: { id: project.id, name: project.name } },
                        ...issue && { issue: { id: issue.id } },
                        ...activity && { activity: { id: activity.id, name: activity.name } },
                        hours, comments, spent_on
                    };
                    await database.table('entries').update(id, update);
                    setEntries(entries => entries.map(entry => entry.id === id ? { ...entry, ...update, project, issue, activity } : entry));
                } else { // create
                    const response = await redmine.createEntry(entry);
                    const { time_entry: { id, project, issue, activity, hours, comments, spent_on, created_on, updated_on } } = await response.json();
                    await database.table('entries').put({ id, project, issue, activity, hours, comments, spent_on, created_on, updated_on });
                    setEntries(entries => [{ id, project, issue, activity, hours, comments, spent_on, created_on, updated_on, ...entry }, ...entries]);
                    const url = settings?.redmine?.baseUrl && `${settings.redmine.baseUrl}/time_entries/${id}/edit`;
                    url && raiseNotice(<label>Time entry <a {...propsLink(url)}>#{id}</a> created</label>);
                }
                setEntry(undefined);
                refs.current.addEntryButton.focus();
            } catch (error) {
                raiseError(error);
            }
        },
        onDelete: async (entry: Partial<EntryExt>) => {
            try {
                const { id } = entry;
                await redmine.deleteEntry(entry);
                await database.table('entries').delete(id);
                setEntries(entries => entries.filter(entry => entry.id !== id));
                setEntry(undefined);
                refs.current.addEntryButton.focus();
            } catch (error) {
                raiseError(error);
            }
        },
        onDuplicate: ({ id, ...entry }: Partial<EntryExt>) => setEntry(entry),
        onEditIssue: async (issue: Partial<Issue>) => {
            try {
                const { id } = issue;
                if (id) {
                    const issue = await redmine.getIssueById(id);
                    const project = issue.project && await database.table('projects').get({ id: issue.project.id });
                    setIssue({ ...issue, project });
                } else {
                    const project = issue.project && await database.table('projects').get({ id: issue.project.id });
                    setIssue({ assigned_to: { id: 0, name: 'me' }, start_date: today, ...issue, project });
                }
            } catch (error) {
                raiseError(error);
            }
        },
        onChangeFavorites: async (favorites: Favorites) => {
            try {
                await storage.set({ favorites });
                setSettings(settings => ({ ...settings, favorites }));
            } catch (error) {
                raiseError(error);
            }
        },
        onDismiss: () => {
            setEntry(undefined);
            refs.current.addEntryButton.focus();
        }
    });

    const propsEditIssue = ({
        show: !!issue, issue, lists, baseUrl: settings?.redmine?.baseUrl, favorites: settings?.favorites, hideInactive: settings?.hideInactive,
        onSubmit: async (issue: Partial<IssueExt>) => {
            try {
                const { id, project, status, subject, description } = issue;
                if (id) { // update
                    await redmine.updateIssue(issue); // 204 No Content: issue was updated
                    const update = { // NOTE: `updated_on` + `closed_on` not updated
                        ...project && { project: { id: project.id, name: project.name } },
                        ...status?.is_closed && { closed_on: '?' },
                        subject, description
                    };
                    await database.table('issues').update(id, update);
                    setLists(lists => ({ ...lists, issues: lists.issues.map(issue => issue.id === id ? { ...issue, ...update } : issue) }));
                } else { // create
                    const response = await redmine.createIssue(issue);
                    const { issue: { id, project, subject, description, created_on, updated_on, closed_on } } = await response.json();
                    await database.table('issues').put({ id, project, subject, description, created_on, updated_on, closed_on });
                    setLists(lists => ({ ...lists, issues: [{ id, project, subject, description, created_on, updated_on, closed_on }, ...lists.issues] }));
                    const url = settings?.redmine?.baseUrl && `${settings.redmine.baseUrl}/issues/${id}`;
                    url && raiseNotice(<label>Issue <a {...propsLink(url)}>#{id}</a> created</label>);
                }
                setIssue(undefined);
                refs.current.addIssueButton.focus();
            } catch (error) {
                raiseError(error);
            }
        },
        onChangeFavorites: async (favorites: Favorites) => {
            try {
                await storage.set({ favorites });
                setSettings(settings => ({ ...settings, favorites }));
            } catch (error) {
                raiseError(error);
            }
        },
        onDismiss: () => {
            setIssue(undefined);
            refs.current.addIssueButton.focus();
        }
    });

    const propsTask = (task: Task) => ({
        task, key: task.id,
        onChange: async (props: Task) => {
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

    const propsDay = (day: string) => ({
        day, key: day, selected: searching || day === today, entries: filteredEntries[day] || [], workHours: settings?.workHours, baseUrl: settings?.redmine?.baseUrl,
        onSelectDay: () => setToday(day === today ? undefined : day),
        onSelectEntry: (entry: EntryExt) => () => setEntry(entry)
    });

    useEffect(() => searching ? refs.current.searchInput?.focus() : refs.current.addEntryButton?.focus(), [searching]); // focus on add entry button / search input
    return <ThemeProvider theme={theme}>
        <Global styles={appStyles} />
        <EditEntry {...propsEditEntry} />
        <EditIssue {...propsEditIssue} />
        <Toaster />
        <div {...propsTitle}>
            <button {...propsAddIssueButton}><FiHash /></button>
            <button {...propsAddEntryButton}><FiClock /></button>
            <input {...propsAddTaskInput} />
            <input {...propsSearchInput} />
            <button {...propsHomeButton}><FiHome /></button>
            <button {...propsRefreshButton}><FiRefreshCw /></button>
            <button {...propsOptionsButton}><FiSettings /></button>
            {/* <button {...propsCipherButton}><FiCoffee /></button> */}
        </div>
        <Bar />
        {filteredTasks.map(task => <EditTask {...propsTask(task)} />)}
        {days.map(day => <Day {...propsDay(day)} />)}
    </ThemeProvider>;
};