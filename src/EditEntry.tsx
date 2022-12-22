import { useState, useRef, useMemo, useEffect, startTransition, ChangeEvent, MutableRefObject } from 'react';
import { FiClock, FiHash, FiPackage, FiX, FiCheck, FiCopy, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { Activity, Entry, Issue, Project } from './apis/redmine';
import { Select } from './atoms/Select';
import { Textarea } from './atoms/Textarea';
import { Dialog } from './Dialog';

export const EditEntry = ({ entry: init, lists, favorites, baseUrl, hideInactive, onSubmit, onDuplicate, onChangeFavorites, onDismiss, onDelete }) => {
    const refs = useRef({
        issueSelect: undefined as HTMLInputElement
    });
    const [entry, setEntry] = useState<Entry>();
    const { id, project, issue, activity, hours, comments, spent_on } = entry || {} as Entry;

    const [rawProjects = [], rawIssues = [], rawActivities = []]: [Project[], Issue[], Activity[]] = lists ?? [];
    const [favoriteProjectIds = [], favoriteIssueIds = [], favoriteActivities = []]: [number[], number[], number[]] = favorites ?? [];

    const sort = <T extends { id: number }>(list: T[], favoriteIds: number[]): Array<T & { favorite: boolean }> => {
        const [favorites, rest] = list.reduce(([favorites, rest], item) => favoriteIds.includes(item.id) ? [[...favorites, item], rest] : [favorites, [...rest, item]], [[], []]);
        return [...favorites.map(item => ({ ...item, favorite: true })), ...rest];
    };
    const projects = useMemo(() => sort(rawProjects, favoriteProjectIds), [rawProjects, favoriteProjectIds]);
    const issues = useMemo(() => sort(project ? rawIssues.filter(issue => issue.project.id === project.id) : rawIssues, favoriteIssueIds), [rawIssues, favoriteIssueIds, project]);
    const activities = useMemo(() => sort(rawActivities, favoriteActivities), [rawActivities, favoriteActivities]);

    const propsProject = {
        placeholder: 'Project', value: project, values: projects,
        render: (project: Project) => <div title={project.description}>{project.name}</div>,
        stringlify: (project: Project) => String(project.id),
        linkify: (project: Project) => `${baseUrl}/projects/${project.id}`,
        filter: (filter: RegExp) => (project: Project) => filter.test(project.name),
        onChange: (project: Project) => setEntry(entry => ({ ...entry, project, issue: undefined })),
        onFavorite: (project: Project & { favorite: boolean }) => onChangeFavorites([
            project.favorite ? favoriteProjectIds.filter(id => id !== project.id) : favoriteProjectIds.concat(project.id),
            favoriteIssueIds, favoriteActivities
        ])
    };
    const propsIssue = {
        placeholder: 'Issue', value: issue, values: issues,
        render: (issue: Issue, short: boolean) => short ?
            <div>#{issue.id} {issue.closed_on ? <del>{issue.subject}</del> : issue.subject}</div> :
            <div title={issue.description}>#{issue.id} {issue.project.name}<br />{issue.closed_on ? <del>{issue.subject}</del> : issue.subject}</div>,
        stringlify: (issue: Issue) => String(issue.id),
        linkify: (issue: Issue) => `${baseUrl}/issues/${issue.id}`,
        filter: hideInactive?.issues ?
            (filter: RegExp) => (issue: Issue) => !issue.closed_on && (filter.test(issue.subject) || filter.test(String(issue.id))) :
            (filter: RegExp) => (issue: Issue) => filter.test(issue.subject) || filter.test(String(issue.id)),
        onEdit: (value: string, issue: Issue) => console.log({ value, issue }),
        onChange: (issue: Issue) => setEntry(entry => ({ ...entry, issue, project: issue?.project })),
        onFavorite: (issue: Issue & { favorite: boolean }) => onChangeFavorites([
            favoriteProjectIds,
            issue.favorite ? favoriteIssueIds.filter(id => id !== issue.id) : favoriteIssueIds.concat(issue.id),
            favoriteActivities
        ]),
        onMount: (innerRefs: MutableRefObject<{ input: HTMLInputElement }>) => refs.current.issueSelect = innerRefs.current.input
    };
    const propsHours = {
        placeholder: 'Hours', value: hours || '', type: 'number', min: 0, max: 10, step: 0.25,
        onChange: event => setEntry(entry => ({ ...entry, hours: Number(event.target.value) }))
    };
    const propsActivity = {
        placeholder: 'Activity', value: activity, values: activities,
        render: (activity: Activity) => <div>{activity.active === false ? <del>{activity.name}</del> : activity.name}</div>,
        stringlify: (activity: Activity) => String(activity.id),
        filter: hideInactive?.activities ?
            (filter: RegExp) => (activity: Activity) => activity.active && filter.test(activity.name) :
            (filter: RegExp) => (activity: Activity) => filter.test(activity.name),
        onChange: (activity: Activity) => setEntry(entry => ({ ...entry, activity })),
        onFavorite: (activity: Activity & { favorite: boolean }) => onChangeFavorites([
            favoriteProjectIds, favoriteIssueIds,
            activity.favorite ? favoriteActivities.filter(id => id !== activity.id) : favoriteActivities.concat(activity.id)
        ]),
    };
    const propsComments = {
        placeholder: 'Comments', value: comments || '',
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setEntry(entry => ({ ...entry, comments: event.target.value }))
    };
    const propsSpentOn = {
        title: 'Spent on', type: 'date', value: spent_on || '',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setEntry(entry => ({ ...entry, spent_on: event.target.value }))
    };
    const propsSubmit = {
        title: 'Submit', onClick: () => onSubmit({ id, project, issue, hours, activity, comments, spent_on })
    };
    const propsDuplicate = {
        title: 'Duplicate', onClick: () => onDuplicate({ project, issue, hours, activity, comments, spent_on })
    }
    const propsClose = {
        title: 'Close', onClick: () => onDismiss()
    }
    const propsDelete = {
        title: 'Delete', onClick: () => onDelete({ id })
    }

    useEffect(() => setEntry(init), [init]);
    useEffect(() => startTransition(() => entry ?
        window.localStorage.setItem('draft-entry', JSON.stringify(entry)) :
        window.localStorage.removeItem('draft-entry')), [entry]);
    return <Dialog show={init} title={id ? 'Edit time entry' : 'New time entry'}>
        <div>
            <label title={'Project'}><FiPackage /></label>
            <Select {...propsProject} />
        </div>
        <hr />
        <div>
            <label title={'Issue'}><FiHash /></label>
            <Select {...propsIssue} />
        </div>
        <hr />
        <div>
            <label title={'Hours'}><FiClock /></label>
            <input {...propsHours} />
            <Select {...propsActivity} />
        </div>
        <hr />
        <div>
            <label title={'Comments'}><FiMessageSquare /></label>
            <Textarea {...propsComments} />
        </div>
        <div>
            <button {...propsSubmit}><FiCheck /></button>
            {id && <button {...propsDuplicate}><FiCopy /></button>}
            <button {...propsClose}><FiX /></button>
            <div><input {...propsSpentOn} /></div>
            {id && <button {...propsDelete}><FiTrash2 /></button>}
        </div>
    </Dialog>;
};
