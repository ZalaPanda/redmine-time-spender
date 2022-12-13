/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationsissue_prioritiesformat */
export interface Priority {
    id: number,
    name: string,
    is_default: boolean,
    active: boolean
}

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat */
export interface Activity {
    id: number,
    name: string,
    active: boolean
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_IssueStatuses */
export interface Status {
    id: number,
    name: string,
    is_closed: boolean
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Trackers */
export interface Tracker {
    id: number,
    name: string,
    default_status: Status
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects */
export interface Project {
    id: number,
    name: string,
    identifier: string,
    description: string,
    trackers: Tracker[], // { id: number, name: string }[]
    created_on: string, // yyyy-MM-ddTHH:mm:ssZ
    updated_on: string // yyyy-MM-ddTHH:mm:ssZ
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues */
export interface Issue {
    id: number,
    project: Project, // { id: number, name: string }
    tracker: Tracker, // { id: number, name: string }
    status: Status,
    priority: Priority, // { id: number, name: string }
    subject: string,
    description: string,
    // start_date: string, // yyyy-MM-dd
    // due_date: string, // yyyy-MM-dd
    // done_ratio: number,
    // is_private: boolean,
    // estimated_hours?: number,
    // spent_hours: number,
    created_on: string, // yyyy-MM-ddTHH:mm:ssZ
    updated_on: string, // yyyy-MM-ddTHH:mm:ssZ
    closed_on: string // yyyy-MM-ddTHH:mm:ssZ
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries */
export interface Entry {
    id: number,
    project: Project, // { id: number, name: string }
    issue?: Issue, // { id: number }
    activity: Activity, // { id: number, name: string }
    hours: number,
    comments: string,
    spent_on: string, // yyyy-MM-dd
    created_on: string, // yyyy-MM-ddTHH:mm:ssZ
    updated_on: string // yyyy-MM-ddTHH:mm:ssZ
};

/** Redmine API */
export interface RedmineAPI {
    getEntries: (fromDay: string) => Promise<any[]>,
    getProjects: () => Promise<any[]>,
    getIssues: (updatedAfter: string) => Promise<any[]>
    getActivities: () => Promise<any>,
    getUser: () => Promise<Response>,
    createEntry: (entry: any) => Promise<Response>,
    updateEntry: (entry: any) => Promise<Response>,
    deleteEntry: (entry: any) => Promise<Response>
};

/** Create Redmine API with base URL and API key */
export const createRedmineApi = (baseUrl: string, apiKey: string): RedmineAPI => {
    const fetchRedmine = async (path: string, method = 'GET', body = undefined) => {
        const response = await fetch(baseUrl.concat(path), {
            method, body, headers: { 'X-Redmine-API-Key': apiKey, ...(body && { 'Content-Type': 'application/json' }) }
        });
        if (response.ok) return response;
        if (response.status === 422) { // 422 Unprocessable Entity
            const { errors } = await response.json(); // API: https://www.redmine.org/projects/redmine/wiki/Rest_api#Validation-errors
            throw new Error(errors.join('\r\n'));
        }
        throw new Error(response.statusText);
    };
    const raiseProgress = (resource, count: number = undefined, total: number = undefined) => window.dispatchEvent(new CustomEvent('progress', { detail: { resource, count, total } }));
    const getEntries = async (fromDay: string) => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries
        raiseProgress('entries');
        const entries = [];
        while (true) {
            const response = await fetchRedmine(`/time_entries.json?user_id=me&limit=100&offset=${entries.length}&from=${fromDay}`);
            const { time_entries: chunk, total_count: total, offset, limit } = await response.json();
            entries.push(...chunk.map(({
                id, project, issue, activity, hours, comments, spent_on, created_on, updated_on
            }) => ({
                id, project, issue, activity, hours, comments, spent_on, created_on, updated_on
            })));
            raiseProgress('entries', entries.length, total);
            if (total <= limit + offset) break;
        }
        return entries;
    };
    const getProjects = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects
        raiseProgress('projects');
        const projects = [];
        while (true) {
            const response = await fetchRedmine(`/projects.json?include=trackers&limit=100&offset=${projects.length}`);
            const { projects: chunk, total_count: total, offset, limit } = await response.json();
            projects.push(...chunk.map(({
                id, name, identifier, description, trackers, created_on, updated_on
            }) => ({
                id, name, identifier, description, trackers, created_on, updated_on
            })));
            raiseProgress('projects', projects.length, total);
            if (total <= limit + offset) break;
        }
        return projects;
    };
    const getIssues = async (updatedAfter: string) => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues
        raiseProgress('issues');
        const issues = [];
        while (true) {
            const response = await fetchRedmine(`/issues.json?limit=100&offset=${issues.length}&status_id=*${updatedAfter ? `&updated_on=>=${updatedAfter}` : ''}`);
            const { issues: chunk, total_count: total, offset, limit } = await response.json();
            issues.push(...chunk.map(({
                id, project, subject, description, created_on, updated_on, closed_on
            }) => ({
                id, project, subject, description, created_on, updated_on, closed_on
            })));
            raiseProgress('issues', issues.length, total);
            if (total <= limit + offset) break;
        }
        return issues;
    };
    const getActivities = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
        raiseProgress('activities');
        const response = await fetchRedmine('/enumerations/time_entry_activities.json');
        const { time_entry_activities: activities } = await response.json();
        raiseProgress('activities', activities.length, activities.length);
        return activities.map(({ id, name, active }) => ({ id, name, active }));
    };
    const getUser = async () => {
        return await fetchRedmine('/my/account.json'); // {"user":{ "id":1, ... }}
    }
    /** [API:Rest_TimeEntries](https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry) */
    const createEntry = async (entry: any) => {
        const { project, issue, hours, activity, comments, spent_on } = entry;
        const body = JSON.stringify({
            time_entry: {
                project_id: project?.id || null,
                issue_id: issue?.id || null,
                activity_id: activity?.id || null,
                hours, comments, spent_on
            }
        });
        return await fetchRedmine(`/time_entries.json`, 'POST', body);
    };
    const updateEntry = async (entry: any) => {
        const { id, project, issue, hours, activity, comments, spent_on } = entry;
        const body = JSON.stringify({
            time_entry: {
                project_id: project?.id || null,
                issue_id: issue?.id || null,
                activity_id: activity?.id || null,
                hours, comments, spent_on
            }
        });
        return await fetchRedmine(`/time_entries/${id}.json`, 'PUT', body);
    };
    const deleteEntry = async (entry: any) => {
        const { id } = entry;
        return await fetchRedmine(`/time_entries/${id}.json`, 'DELETE');
    };
    return { getEntries, getProjects, getIssues, getActivities, getUser, createEntry, updateEntry, deleteEntry };
};