export const createRedmineApi = (baseUrl, apiKey) => {
    const fetchRedmine = async (path, method, body) => {
        const response = await fetch(baseUrl.concat(path), {
            method, body, headers: { 'X-Redmine-API-Key': apiKey, 'Content-Type': body && 'application/json' }
        });
        if (response.ok) return response;
        if (response.status === 422) { // 422 Unprocessable Entity
            const { errors } = await response.json(); // API: https://www.redmine.org/projects/redmine/wiki/Rest_api#Validation-errors
            throw new Error(errors.join('\r\n'));
        }
        throw new Error(response.statusText);
    };
    const getEntries = async (fromDay) => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Listing-time-entries
        const entries = [];
        while (true) {
            const response = await fetchRedmine(`/time_entries.json?user_id=me&limit=100&offset=${entries.length}&from=${fromDay}`);
            const { time_entries: chunk, total_count: total, offset, limit } = await response.json();
            entries.push(...chunk.map(({
                id, project, issue, user, activity, hours, comments, spent_on, created_on, updated_on
            }) => ({
                id, project, issue, user, activity, hours, comments, spent_on, created_on, updated_on
            })));
            if (total <= limit + offset) break;
        }
        return entries;
    };
    const getProjects = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Projects#Listing-projects
        const projects = [];
        while (true) {
            const response = await fetchRedmine(`/projects.json?limit=100&offset=${projects.length}`);
            const { projects: chunk, total_count: total, offset, limit } = await response.json();
            projects.push(...chunk.map(({
                id, name, identifier, description, created_on, updated_on
            }) => ({
                id, name, identifier, description, created_on, updated_on
            })));
            if (total <= limit + offset) break;
        }
        return projects;
    };
    const getIssues = async (updatedAfter) => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Issues#Listing-issues
        const issues = [];
        while (true) {
            const response = await fetchRedmine(`/issues.json?limit=100&offset=${issues.length}&status_id=*${updatedAfter ? `&updated_on=>=${updatedAfter}` : ''}`);
            const { issues: chunk, total_count: total, offset, limit } = await response.json();
            issues.push(...chunk.map(({
                id, project, subject, description, created_on, updated_on, closed_on
            }) => ({
                id, project, subject, description, created_on, updated_on, closed_on
            })));
            if (total <= limit + offset) break;
        }
        return issues;
    };
    const getActivities = async () => { // API: https://www.redmine.org/projects/redmine/wiki/Rest_Enumerations#enumerationstime_entry_activitiesformat
        const response = await fetchRedmine('/enumerations/time_entry_activities.json');
        const { time_entry_activities: activities } = await response.json();
        return activities.map(({ id, name, active }) => ({ id, name, active }));
    };
    /** [API:Rest_TimeEntries](https://www.redmine.org/projects/redmine/wiki/Rest_TimeEntries#Creating-a-time-entry) */
    const createEntry = async (entry) => {
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
    const updateEntry = async (entry) => {
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
    const deleteEntry = async (entry) => {
        const { id } = entry;
        return await fetchRedmine(`/time_entries/${id}.json`, 'DELETE');
    };
    return { getEntries, getProjects, getIssues, getActivities, createEntry, updateEntry, deleteEntry };
};