export type Reference = {
    id: number,
    name: string
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationsissue_prioritiesformat */
export type Priority = {
    id: number,
    name: string,
    is_default: boolean,
    active: boolean
}

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat */
export type Activity = {
    id: number,
    name: string
    active: boolean
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_IssueStatuses */
export type Status = {
    id: number,
    name: string,
    is_closed: boolean
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Trackers */
export type Tracker = {
    id: number,
    name: string,
    default_status: Status
};

export type Category = {
    id: number,
    name: string
}

export type CustomField = {
    id?: number,
    name: string,
    multiple?: boolean,
    value: string | string[]
}

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects */
export type Project = {
    id: number,
    name: string,
    identifier: string,
    description: string,
    trackers: Reference[],
    issue_categories: Reference[],
    issue_custom_fields: Reference[],
    created_on: string, // yyyy-MM-ddTHH:mm:ssZ
    updated_on: string // yyyy-MM-ddTHH:mm:ssZ
};

export type Issue = {
    id: number,
    project: Reference,
    subject: string,
    description: string,
    created_on: string, // yyyy-MM-ddTHH:mm:ssZ
    updated_on: string, // yyyy-MM-ddTHH:mm:ssZ
    closed_on: string // yyyy-MM-ddTHH:mm:ssZ
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues */
export type IssueExt = Issue & {
    project: Project,
    tracker: Reference,
    status: Status,
    allowed_statuses?: Status[], // since 5.0.x
    priority: Reference,
    category: Category,
    assigned_to: Reference,
    custom_fields: CustomField[],
    start_date: string, // yyyy-MM-dd
    due_date: string, // yyyy-MM-dd
    done_ratio: number,
    is_private: boolean,
    estimated_hours?: number,
    spent_hours: number
};

/** @see https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries */
export type Entry = {
    id: number,
    project: Reference,
    issue?: { id: number },
    activity: Reference,
    hours: number,
    comments: string,
    spent_on: string, // yyyy-MM-dd
    created_on: string, // yyyy-MM-ddTHH:mm:ssZ
    updated_on: string // yyyy-MM-ddTHH:mm:ssZ
};

export type EntryExt = Entry & {
    project: Project,
    issue?: Issue,
    activity: Activity
};

/** Redmine API */
export interface RedmineAPI {
    getEntries: (fromDay: string) => Promise<Entry[]>,
    getProjects: () => Promise<Project[]>,
    getIssues: (updatedAfter: string) => Promise<Issue[]>,
    getIssueById: (id: number) => Promise<IssueExt & { project: Reference }>,
    getActivities: () => Promise<Activity[]>,
    getPriorities: () => Promise<Priority[]>,
    getStatuses: () => Promise<Status[]>,
    getUser: () => Promise<Response>,
    createEntry: (entry: Partial<EntryExt>) => Promise<Response>,
    updateEntry: (entry: Partial<EntryExt>) => Promise<Response>,
    deleteEntry: (entry: Partial<EntryExt>) => Promise<Response>,
    createIssue: (issue: Partial<IssueExt>) => Promise<Response>,
    updateIssue: (issue: Partial<IssueExt>) => Promise<Response>,
    deleteIssue: (issue: Partial<IssueExt>) => Promise<Response>
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
            const { time_entries: chunk, total_count: total, offset, limit } = await response.json() as { time_entries: Entry[], total_count: number, offset: number, limit: number };
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
            const response = await fetchRedmine(`/projects.json?include=trackers,issue_categories,issue_custom_fields&limit=100&offset=${projects.length}`);
            const { projects: chunk, total_count: total, offset, limit } = await response.json() as { projects: Project[], total_count: number, offset: number, limit: number };
            projects.push(...chunk.map(({
                id, name, identifier, description, trackers, issue_categories, issue_custom_fields, created_on, updated_on
            }) => ({
                id, name, identifier, description, trackers, issue_categories, issue_custom_fields, created_on, updated_on
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
            const { issues: chunk, total_count: total, offset, limit } = await response.json() as { issues: Issue[], total_count: number, offset: number, limit: number };
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
    const getIssueById = async (id: number) => {
        const response = await fetchRedmine(`/issues/${id}.json?include=allowed_statuses`);
        const { issue } = await response.json() as { issue: IssueExt };
        return issue;
    };
    const getActivities = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
        raiseProgress('activities');
        const response = await fetchRedmine('/enumerations/time_entry_activities.json');
        const { time_entry_activities: activities } = await response.json() as { time_entry_activities: Activity[] };
        raiseProgress('activities', activities.length, activities.length);
        return activities.map(({ id, name, active }) => ({ id, name, active }));
    };
    const getPriorities = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationsissue_prioritiesformat
        raiseProgress('priorities');
        const response = await fetchRedmine('/enumerations/issue_priorities.json');
        const { issue_priorities: priorities } = await response.json() as { issue_priorities: Priority[] };
        raiseProgress('priorities', priorities.length, priorities.length);
        return priorities.map(({ id, name, is_default, active }) => ({ id, name, is_default, active }));
    };
    const getStatuses = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_IssueStatuses
        raiseProgress('statuses');
        const response = await fetchRedmine('/issue_statuses.json');
        const { issue_statuses: statuses } = await response.json() as { issue_statuses: Status[] };
        raiseProgress('statuses', statuses.length, statuses.length);
        return statuses.map(({ id, name, is_closed }) => ({ id, name, is_closed }));
    };
    const getUser = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_MyAccount
        return await fetchRedmine('/my/account.json'); // {"user":{ "id":1, ... }}
    }
    const createEntry = async (entry: Partial<EntryExt>) => { // API https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry
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
    const updateEntry = async (entry: Partial<EntryExt>) => {
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
    const deleteEntry = async (entry: Partial<EntryExt>) => {
        const { id } = entry;
        return await fetchRedmine(`/time_entries/${id}.json`, 'DELETE');
    };
    const createIssue = async (issue: Partial<IssueExt>) => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Creating-an-issue
        const { project, tracker, status, priority, subject, description, category, is_private, assigned_to, custom_fields, estimated_hours, done_ratio, start_date, due_date } = issue;
        const body = JSON.stringify({
            issue: {
                ...project && { project_id: project.id },
                ...tracker && { tracker_id: tracker.id },
                ...status && { status_id: status.id },
                ...priority && { priority_id: priority.id },
                ...category && { category_id: category.id },
                ...assigned_to?.name === 'me' && { assigned_to_id: 'me' },
                ...custom_fields && { custom_fields },
                subject, description, is_private: !!is_private, estimated_hours, done_ratio, start_date, due_date
            }
        });
        return await fetchRedmine(`/issues.json`, 'POST', body);
    };
    const updateIssue = async (issue: Partial<IssueExt>) => {
        const { id, project, tracker, status, priority, subject, description, category, is_private, custom_fields, estimated_hours, done_ratio, start_date, due_date } = issue;
        const body = JSON.stringify({
            issue: {
                project_id: project?.id || null,
                tracker_id: tracker?.id || null,
                status_id: status?.id || null,
                priority_id: priority?.id || null,
                category_id: category?.id || null,
                custom_fields: custom_fields || null,
                subject, description, is_private: !!is_private, estimated_hours, done_ratio, start_date, due_date
            }
        });
        return await fetchRedmine(`/issues/${id}.json`, 'PUT', body);
    };
    const deleteIssue = async (issue: Partial<IssueExt>) => { // NOTE: not used!
        const { id } = issue;
        return await fetchRedmine(`/issues/${id}.json`, 'DELETE');
    };
    return {
        getEntries, getProjects, getIssues, getIssueById, getActivities, getPriorities, getStatuses, getUser,
        createEntry, updateEntry, deleteEntry, createIssue, updateIssue, deleteIssue
    };
};