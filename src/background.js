// import dayjs from 'dayjs';
// import { database, storage, log } from './storage.js';

// const refreshEntries = async (url, key, days) => {
//     try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries
//         const from = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
//         await database.table('entries').where('spent_on').below(from).delete(); // remove old entries // .filter(entry => entry.spent_on < from)
//         const last = await database.table('entries').orderBy('updated_on').last() || {};
//         const entries = [];
//         while (true) {
//             const req = await fetch(`${url}/time_entries.json?user_id=me&limit=100&offset=${entries.length}&from=${from}`, { headers: { 'X-Redmine-API-Key': key } });
//             const { time_entries: chunk, total_count: total, offset, limit } = await req.json();
//             entries.push(...chunk); // { id, project, issue, user, activity, hours, comments, spent_on, created_on, updated_on }
//             if (total <= limit + offset) break;
//         }
//         if (last?.updated_on && !entries.find(entry => entry.updated_on > last.updated_on)) return;
//         await database.table('entries').bulkPut(entries);
//         return true;
//     } catch (error) {
//         await log('refreshEntries', error);
//     }
// };

// const refreshProjects = async (url, key) => { // full sync
//     try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects
//         const last = await database.table('projects').orderBy('updated_on').last() || {};
//         const projects = [];
//         while (true) {
//             const req = await fetch(`${url}/projects.json?limit=100&offset=${projects.length}`, { headers: { 'X-Redmine-API-Key': key } });
//             const { projects: chunk, total_count: total, offset, limit } = await req.json();
//             projects.push(...chunk); // { id, name, identifier, description, created_on, updated_on }
//             if (total <= limit + offset) break;
//         }
//         if (last?.updated_on && !projects.find(project => project.updated_on > last.updated_on)) return;
//         await database.table('projects').clear();
//         await database.table('projects').bulkAdd(projects);
//         return true;
//     } catch (error) {
//         await log('refreshProjects', error);
//     }
// };

// const refreshIssues = async (url, key) => { // incremental sync
//     try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues
//         const last = await database.table('issues').orderBy('updated_on').last() || {};
//         const issues = [];
//         while (true) {
//             const req = await fetch(`${url}/issues.json?limit=100&offset=${issues.length}&status_id=*${last?.updated_on ? `&updated_on=>=${last.updated_on}` : ''}`, { headers: { 'X-Redmine-API-Key': key } });
//             const { issues: chunk, total_count: total, offset, limit } = await req.json();
//             issues.push(...chunk); // { id, project, subject, description, created_on, updated_on, closed_on }
//             if (total <= limit + offset) break;
//         }
//         if (last?.updated_on && !issues.find(issue => issue.updated_on > last.updated_on)) return;
//         await database.table('issues').bulkPut(issues);
//         return true;
//     } catch (error) {
//         await log('refreshIssues', error);
//     }
// };

// const refreshActivities = async (url, key) => {
//     try { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
//         const req = await fetch(`${url}/enumerations/time_entry_activities.json`, { headers: { 'X-Redmine-API-Key': key } });
//         const { time_entry_activities: activities } = await req.json();
//         await database.table('activities').bulkPut(activities); // { id, name, active }
//     } catch (error) {
//         await log('refreshActivities', error);
//     }
// };

// const refresh = async (sendResponse) => {
//     const { url, key, days } = await storage.get(['url', 'key', 'days']);
//     const results = await Promise.all([
//         refreshEntries(url, key, days),
//         refreshProjects(url, key),
//         refreshIssues(url, key),
//         refreshActivities(url, key)
//     ]);
//     sendResponse(results);
// };

// const checkRefreshAlarm = () => chrome.alarms.get('refresh', (alarm) => alarm || chrome.alarms.create('refresh', { periodInMinutes: 3.0 }));
// chrome.runtime.onInstalled.addListener(checkRefreshAlarm);
chrome.action.onClicked.addListener(() => chrome.browserAction.setPopup()); // open popup

// chrome.alarms.get('refresh', (alarm) => alarm || chrome.alarms.create('refresh', { periodInMinutes: 1.0 }));

// chrome.runtime.onSuspend.addListener(() => log('onSuspend'));
// chrome.runtime.onConnect.addListener(() => log('onConnect'));

// chrome.alarms.onAlarm.addListener((alarm) => {
//     // log('onAlarm', alarm);
// });

// chrome.runtime.onStartup.addListener(() => {
//     log('onStartup');
//     // chrome.storage.local.set({ value: 'value' });
//     // chrome.browserAction.setBadgeText({ text: 'Started' });
// });

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (sender.id !== chrome.runtime.id) return false;
//     if (request.type === 'refresh') {
//         refresh(sendResponse);
//         return true;
//     }
// });