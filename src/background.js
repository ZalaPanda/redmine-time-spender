import dayjs from 'dayjs';
import { database, settings, log } from './storage.js';
import secret from '../secret.json';

settings.set(secret);

const refreshProjects = async (url, key) => { // full sync
    try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects
        const last = await database.table('projects').orderBy('updated_on').last() || {};
        const projects = [];
        while (true) {
            const req = await fetch(`${url}/projects.json?limit=100&offset=${projects.length}`, { headers: { 'X-Redmine-API-Key': key } });
            const { projects: chunk, total_count: total, offset, limit } = await req.json();
            projects.push(...chunk); // { id, name, identifier, description, created_on, updated_on }
            if (total <= limit + offset) break;
        }
        if (last && projects.find(project => project.updated_on > last.updated_on)) return;
        await database.table('projects').clear();
        await database.table('projects').bulkAdd(projects);
    } catch (error) {
        await log('refreshProjects', error);
    }
};

const refreshIssues = async (url, key) => { // incremental sync
    try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues
        const last = await database.table('issues').orderBy('updated_on').last() || {};
        const issues = [];
        while (true) {
            const req = await fetch(`${url}/issues.json?limit=100&offset=${issues.length}&status_id=*${last ? `&updated_on>${last.updated_on}` : ''}`, { headers: { 'X-Redmine-API-Key': key } });
            const { issues: chunk, total_count: total, offset, limit } = await req.json();
            issues.push(...chunk); // { id, project, subject, description, created_on, updated_on, closed_on }
            if (total <= limit + offset) break;
        }
        await database.table('issues').bulkPut(issues);
    } catch (error) {
        await log('refreshIssues', error);
    }
};

const refreshActivities = async (url, key) => {
    try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
        const req = await fetch(`${url}/enumerations/time_entry_activities.json`, { headers: { 'X-Redmine-API-Key': key } });
        const { time_entry_activities: activities } = await req.json();
        await database.table('activities').bulkPut(activities); // { id, name, active }
    } catch (error) {
        await log('refreshActivities', error);
    }
};

const refreshEntries = async (url, key, days) => {
    try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries
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
        if (last && entries.find(entry => entry.updated_on > last.updated_on)) return;
        await database.table('entries').bulkPut(entries);
    } catch (error) {
        await log('refreshEntries', error);
    }
};

const updateEntry = async ({ id, issue, project, spent_on, hours, activity }) => {
    try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry
        const { url, key } = await settings.get({ url: null, key: null });
        const body = JSON.stringify({
            time_entry: {
                issue_id: issue?.id,
                project_id: project?.id,
                spent_on: spent_on,
                hours: hours,
                activity_id: activity?.id
            }
        });
        const req = await fetch(`${url}/time_entries${id ? `/${id}` : ''}.json`, { headers: { 'X-Redmine-API-Key': key }, method: id ? 'PUT' : 'POST', body });
        const update = await req.json();
        await database.entries.put(update); // NOTE: update or use the redmine version?!?
        await log('updateEntry', update);
        return update;
    } catch (error) {
        await log('updateEntry', error);
    }
};

const deleteEntry = async ({ id }) => {
    try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Deleting-a-time-entry
        const { url, key } = await settings.get({ url: null, key: null });
        const req = await fetch(`${url}/time_entries/${id}.json`, { headers: { 'X-Redmine-API-Key': key }, method: 'DELETE' });
        if (!req.ok) throw req.statusText;
        await database.entries.delete(id);
        await log('deleteEntry', update);
    } catch (error) {
        await log('updateEntry', error);
    }
};

const createTask = async ({ date, done, comments }) => {
    try {
        const id = await database.entries.put({ date, done, comments });
        return { id, date, done, comments };
    } catch (error) {
        await log('updateTask', error);
    }
};
const updateTask = async ({ id, date, done, comments }) => {
    try {
        await database.entries.put({ id, date, done, comments });
    } catch (error) {
        await log('updateTask', error);
    }
};
const deleteTask = async ({ id }) => {
    try {
        await database.entries.delete(id);
    } catch (error) {
        await log('updateTask', error);
    }
};

// const checkRefreshAlarm = () => chrome.alarms.get('refresh', (alarm) => alarm || chrome.alarms.create('refresh', { periodInMinutes: 3.0 }));
// chrome.runtime.onInstalled.addListener(checkRefreshAlarm);
chrome.alarms.get('refresh', (alarm) => alarm || chrome.alarms.create('refresh', { periodInMinutes: 1.0 }));

chrome.runtime.onSuspend.addListener(() => log('onSuspend'));
chrome.runtime.onConnect.addListener(() => log('onConnect'));

chrome.alarms.onAlarm.addListener((alarm) => {
    // log('onAlarm', alarm);
    test();
});

chrome.runtime.onStartup.addListener(() => {
    log('onStartup');
    // chrome.storage.local.set({ value: 'value' });
    // chrome.browserAction.setBadgeText({ text: 'Started' });
});

// const refreshAll = async () => {

// };

const test = async () => {
    const { kpi } = await settings.get('kpi');
    try {
        const req = await fetch('https://zalnt238.europe.ad.flextronics.com/TestKPI/login.asp');
        const res = await req.text();
        if (!res.includes('Reflecting the organizational Goals')) throw 'Response error!';
        if (kpi) return;
        chrome.action.setBadgeText({ text: '' });
        chrome.notifications.create(null, {
            type: 'basic',
            iconUrl: 'img/icon-48.png',
            title: 'TestKPI OK!',
            message: req.statusText || '?',
            priority: 2
        });
        settings.set({ kpi: true });
    } catch (error) {
        log('test', error);
        if (!kpi) return;
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.notifications.create(null, {
            type: 'basic',
            iconUrl: 'img/icon-48.png',
            title: 'TestKPI down!',
            message: error?.toString() || '?',
            priority: 2
        });
        settings.set({ kpi: false });
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    // if (request.type === 'test') sendResponse('hello');
    if (request.type === 'test') {
        test();
        sendResponse('OK');
    }
    if (request.type === 'loaded') {
        const reply = async (fn) => {
            const entries = await database.entries.toArray();
            const entry_issues = await database.issues.bulkGet([...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))]);
            const issues = await database.issues.filter(issue => !issue.closed_on).toArray();
            const activities = await database.activities.toArray();
            const projects = await database.projects.toArray();
            const tasks = await database.tasks.toArray();
            chrome.runtime.sendMessage({
                entries: entries.map(entry => ({ ...entry, issue: entry.issue && entry_issues.find(issue => issue.id === entry.issue.id) })),
                issues, activities, projects, tasks
            });
            // fn({
            //     entries: entries.map(entry => ({ ...entry, issue: entry.issue && entry_issues.find(issue => issue.id === entry.issue.id) })),
            //     issues, activities, projects, tasks
            // });
            fn('done');
        };
        reply(sendResponse);
        return true;

        // sendResponse('ok');
        // const entries = await database.entries.toArray();
        // const ids = [...new Set(entries.filter(entry => entry.issue).map(entry => entry.issue.id))];
        // const issues = await database.issues.bulkGet(ids);
        // chrome.runtime.sendMessage({
        //     // entries: await database.entries.toArray(),
        //     // issues: await database.issues.filter(issue => issue.active).toArray(),
        //     entries: entries.map(entry => ({ ...entry, issue: entry.issue && issues.find(issue => issue.id === entry.issue.id) })),
        //     issues: await database.issues.filter(issue => issue.active).toArray(),
        //     activities: await database.activities.toArray(),
        //     projects: await database.projects.orderBy('order').toArray(),
        // });
    }
    if (request.type === 'times') {
        const { id, times } = request;
        database.entries.update(id, times);
    }
    if (request.type === 'refresh') {
        const refresh = async () => {
            const { url, key, days } = await settings.get({ url: null, key: null, days: null });
            refreshProjects(url, key);
            refreshActivities(url, key);
            refreshIssues(url, key);
            refreshEntries(url, key, days);
        }
        refresh();
        // sendResponse('ok');
        // chrome.runtime.sendMessage({ entries: await database.entries.toArray() });
        // sendResponse();
        // return true;
    }
    return true;
});