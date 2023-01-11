import { useState, useRef, useMemo, useEffect, startTransition, ChangeEvent, FocusEvent, KeyboardEvent, MutableRefObject } from 'react';
import { css, Theme } from '@emotion/react';
import { margin } from 'polished';
import { FiClock, FiHash, FiPackage, FiX, FiCheck, FiCopy, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { Activity, EntryExt, Issue, Project } from './apis/redmine';
import { Favorites, Lists } from './App';
import { Select } from './atoms/Select';
import { Textarea } from './atoms/Textarea';
import { Dialog } from './Dialog';

const fieldsStyles = (theme: Theme) => css({
    '&>div': {
        display: 'flex', alignItems: 'center', padding: 2,
        '&>label': { color: theme.field.text }, // label with svg icon
        '&>div': { flexGrow: 1 }, // project, issue, activity
        '&>textarea': { color: theme.muted, flexGrow: 1 } // comments
    },
    '&>div:focus-within': {
        '&>label': { color: theme.field.focus }, // label with svg icon
    },
    '&>hr': { ...margin(0, 10, 0, 30), border: 0, borderBottom: 1, borderStyle: 'solid', borderColor: theme.border }
});

interface EditEntryProps {
    entry: Partial<EntryExt>,
    lists: Lists,
    favorites?: Favorites,
    baseUrl?: string,
    hideInactive?: { issues: boolean, activities: boolean },
    onSubmit: (entry: Partial<EntryExt>) => void,
    onDuplicate: (entry: Partial<EntryExt>) => void,
    onDelete: (entry: Partial<EntryExt>) => void,
    onEditIssue: (issue: Partial<Issue>) => void,
    onChangeFavorites: (favorites: Favorites) => void,
    onDismiss: () => void,
};

export const EditEntry = ({ entry: init, lists, favorites, baseUrl, hideInactive, onSubmit, onDuplicate, onDelete, onEditIssue, onChangeFavorites, onDismiss }: EditEntryProps) => {
    const uniqueKey = useMemo(() => init ? Date.now() : undefined, [init]);
    const refs = useRef({
        issueSelect: undefined as HTMLInputElement
    });
    const [entry, setEntry] = useState<Partial<EntryExt>>();
    const { id, project, issue, activity, hours, comments, spent_on } = entry || {};

    const sort = <T extends { id: number }>(list: T[], favoriteIds: number[] = []): Array<T & { favorite: boolean }> => {
        const [favorites, rest] = list.reduce(([favorites, rest], item) => favoriteIds.includes(item.id) ? [[...favorites, item], rest] : [favorites, [...rest, item]], [[], []]);
        return [...favorites.map(item => ({ ...item, favorite: true })), ...rest];
    };
    const projects = useMemo(() => sort(lists.projects, favorites?.projects), [lists.projects, favorites?.projects]);
    const issues = useMemo(() => sort(project ? lists.issues.filter(issue => issue.project.id === project.id) : lists.issues, favorites?.issues), [project, lists.issues, favorites?.issues]);
    const activities = useMemo(() => sort(lists.activities, favorites?.activities), [lists.activities, favorites?.activities]);

    const dialogProps = {
        show: init,
        Header: <><FiClock/>{id ? `Time entry #${id}` : `New time entry`}</>,
        onShow: () => refs.current.issueSelect.focus(),
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            const { defaultPrevented, key } = event;
            if (defaultPrevented) return;
            if (key === 'Escape' || key === 'Esc') {
                debugger;
                onDismiss();
                return event.preventDefault();
            }
        }
    };
    const propsProject = {
        placeholder: 'Project', value: project, values: projects,
        render: (project: Project) => <div title={project.description}>{project.name}</div>,
        stringlify: (project: Project) => String(project.id),
        linkify: (project: Project) => `${baseUrl}/projects/${project.id}`,
        filter: (filter: RegExp) => (project: Project) => filter.test(project.name),
        onChange: (project: Project) => setEntry(entry => ({ ...entry, project, issue: undefined })),
        onFavorite: (project: Project & { favorite: boolean }) => onChangeFavorites({
            ...favorites, projects: project.favorite ? (favorites?.projects || []).filter(id => id !== project.id) : (favorites?.projects || []).concat(project.id)
        })
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
        onEdit: (subject: string, issue: Issue) => onEditIssue(issue || { subject, project }),
        onChange: (issue: Issue) => setEntry(entry => ({ ...entry, issue, project: issue?.project && projects.find(project => project.id === issue.project.id) })),
        onFavorite: (issue: Issue & { favorite: boolean }) => onChangeFavorites({
            ...favorites, issues: issue.favorite ? (favorites?.issues || []).filter(id => id !== issue.id) : (favorites?.issues || []).concat(issue.id)
        }),
        onMount: (innerRefs: MutableRefObject<{ input: HTMLInputElement }>) => refs.current.issueSelect = innerRefs.current.input
    };
    const propsHours = {
        placeholder: 'Hours', value: hours || '', type: 'number', min: 0, max: 10, step: 0.25,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setEntry(entry => ({ ...entry, hours: Number(event.target.value) }))
    };
    const propsActivity = {
        placeholder: 'Activity', value: activity, values: activities,
        render: (activity: Activity) => <div>{activity.name}</div>,
        stringlify: (activity: Activity) => String(activity.id),
        filter: hideInactive?.activities ?
            (filter: RegExp) => (activity: Activity) => activity.active && filter.test(activity.name) :
            (filter: RegExp) => (activity: Activity) => filter.test(activity.name),
        onChange: (activity: Activity) => setEntry(entry => ({ ...entry, activity })),
        onFavorite: (activity: Activity & { favorite: boolean }) => onChangeFavorites({
            ...favorites, activities: activity.favorite ? (favorites?.activities || []).filter(id => id !== activity.id) : (favorites?.activities || []).concat(activity.id)
        })
    };
    const propsComments = {
        placeholder: 'Comments', key: uniqueKey, defaultValue: comments || '',
        onBlur: (event: FocusEvent<HTMLTextAreaElement>) => setEntry(entry => ({ ...entry, comments: event.target.value }))
    };
    const propsSpentOn = {
        title: 'Spent on', type: 'date', value: spent_on || '',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setEntry(entry => ({ ...entry, spent_on: event.target.value }))
    };
    const propsSubmit = {
        title: 'Submit', onClick: () => onSubmit(entry)
    };
    const propsDuplicate = {
        title: 'Duplicate', onClick: () => onDuplicate(entry)
    };
    const propsDelete = {
        title: 'Delete', onClick: () => onDelete(entry)
    };
    const propsClose = {
        title: 'Close', onClick: () => onDismiss()
    };

    useEffect(() => setEntry(init), [init]);
    useEffect(() => startTransition(() => entry ?
        window.localStorage.setItem('draft-entry', JSON.stringify(entry)) :
        window.localStorage.removeItem('draft-entry')), [entry]);
    return <Dialog {...dialogProps}>
        <div css={fieldsStyles}>
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
        </div>
    </Dialog>;
};
