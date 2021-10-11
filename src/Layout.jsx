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
import { cookieKey, encryptItems, decryptItems } from './crypto.js';

const useStyles = createUseStyles(
    /** @param {Theme} theme */ theme => ({ // color codes: https://www.colorsandfonts.com/color-system
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
    }, [settings?.refresh]);

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

    // useEffect(() => {
    //     chrome.permissions.getAll(permissions => console.log({ permissions }));
    // });
    const test = async () => {
        console.time('db');
        const issues = await database.table('issues').toArray();
        console.timeEnd('db');

        const { url } = settings;
        // const key = await cookieKey(url).set();
        const key = await cookieKey(url).get();
        // console.time('encryptItems');
        // const encrypted = encryptItems(key, database.table('issues').schema, issues);
        // console.timeEnd('encryptItems');
        // console.log(encrypted);

        // const result = await database.table('issues').bulkPut(encrypted);
        // console.log(result);

        console.time('decryptItems');
        const decrypted = decryptItems(key, issues);
        console.timeEnd('decryptItems');
        console.log(decrypted);

        // const schema = database.table('issues').schema;
        // const keys = [schema.primKey.name, ...schema.indexes.map(index => index.name)].filter(key => key);
        // console.time('strip');
        // const strip = issues.map(entry => ([
        //     Object.fromEntries(Object.entries(entry).filter(([key]) => keys.includes(key))),
        //     // { time: new Date().toJSON() }
        //     Object.fromEntries(Object.entries(entry).filter(([key]) => !keys.includes(key)))
        // ]));
        // console.timeEnd('strip');
        // // console.log(strip);
        // const encoder = new TextEncoder();
        // const decoder = new TextDecoder();
        // // console.time('encoded');
        // // const encoded = strip.map(([keys, values]) => ([keys, encoder.encode(JSON.stringify(values))]));
        // // console.timeEnd('encoded');
        // // console.log(encoded);

        // const encode = (encoder, key) => async ([keys, values]) => {
        //     const text = JSON.stringify(values);
        //     // const data = decodeUTF8(text);
        //     const data = encoder.encode(text);
        //     const iv = window.crypto.getRandomValues(new Uint8Array(16));
        //     const code = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
        //     // const blob = new Blob([iv, code]);
        //     return { ...keys, blob: [iv, code] };
        // };
        // const decode = (decoder, key) => async ({ blob, ...keys }) => {
        //     // const iv = await blob.slice(0, 16).arrayBuffer();
        //     // const code = await blob.slice(16).arrayBuffer();
        //     const [iv, code] = blob;
        //     const data = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, code);
        //     // const text = encodeUTF8(new Uint8Array(data));
        //     const text = decoder.decode(data);
        //     const values = JSON.parse(text);
        //     return { ...keys, ...values };
        // };
        // const generateKey = rawKey => window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        // const secret = window.crypto.getRandomValues(new Uint8Array(32));
        // const key = await generateKey(secret);
        // // const item1 = await encode(encoder, key)(strip[0]);
        // // const item2 = await decode(decoder, key)(item1);



        // const x = generateKey1();
        // console.time('encode1');
        // const xxx = strip.map(([keys, values]) => ([keys, encrypt1(encoder, values, x)]));
        // console.timeEnd('encode1');
        // console.time('decode1');
        // const zzz = xxx.map(([keys, values]) => ([keys, decrypt1(decoder, values, x)]));
        // console.timeEnd('decode1');
        // console.log(zzz);

        // console.time('encode');
        // const fn1 = encode(encoder, key);
        // const save = await Promise.all(strip.map(fn1));
        // console.timeEnd('encode');

        // console.log(save.map(item => item.blob[1].byteLength));

        // console.time('decode');
        // const fn2 = decode(decoder, key);
        // const load = await Promise.all(save.map(fn2));
        // console.timeEnd('decode');
        // console.log(load);
        // [1]
        // encode: 609.43994140625 ms
        // decode: 1748.511962890625 ms

        // chrome.sessions.getDevices(devices => console.log({ devices }));
        // chrome.identity.getProfileUserInfo(userInfo => console.log(userInfo));
        // chrome.permissions.request({
        //     permissions: ['cookies', 'webRequest'],
        //     origins: ['https://redmine.bhu.flextronics.com/']
        // }, (granted) => {
        //     // The callback argument will be true if the user granted the permissions.
        //     debugger;
        //     // if (granted) {
        //     //     doSomething();
        //     // } else {
        //     //     doSomethingElse();
        //     // }
        // });

        // chrome.permissions.contains({ origins: ['https://redmine.bhu.flextronics.com/'], permissions: ['cookies'] }, result => {
        //     console.log({ result });
        //     if (!result) chrome.permissions.request({ origins: ['https://redmine.bhu.flextronics.com/'], permissions: ['cookies'] }, granted => {
        //         console.log({ granted });
        //         // if (!granted) return;
        //         chrome.cookies.set({
        //             url: 'https://redmine.bhu.flextronics.com/',
        //             name: 'key',
        //             value: new Date().toJSON(),
        //             httpOnly: true,
        //             sameSite: "strict",
        //             secure: true,
        //             expirationDate: 2147483647 // we will have a problem in 2038
        //         }, (cookie) => console.log({ cookie }));
        //     });
        // });
    }

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
            <button onClick={test}><FiSettings /></button>
        </div>
        {filteredTasks.map(task => <Task {...propsTask(task)} />)}
        {days.map(day => <Day {...propsDay(day)} />)}
    </>;
};
