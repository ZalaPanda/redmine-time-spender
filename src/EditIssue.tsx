import { useState, useRef, useMemo, useEffect, startTransition, ChangeEvent, MutableRefObject } from 'react';
import { FiClock, FiHash, FiPackage, FiX, FiCheck, FiCopy, FiMinimize2, FiMaximize2, FiTrash2, FiMessageSquare, FiSmile } from 'react-icons/fi';
import { Activity, Category, Entry, Issue, IssueExt, Priority, Project, Status, Tracker } from './apis/redmine';
import { Favorites, Lists } from './App';
import { Checkbox } from './atoms/Checkbox';
import { Select } from './atoms/Select';
import { Textarea } from './atoms/Textarea';
import { Dialog } from './Dialog';

interface EditEntryProps {
    issue: Partial<IssueExt>,
    lists: Lists,
    favorites: Favorites,
    baseUrl?: string,
    hideInactive?: { issues: boolean, activities: boolean },
    onSubmit: (entry: Partial<Issue>) => void,
    onDelete: (entry: Partial<Issue>) => void
    onChangeFavorites: (favorites: Favorites) => void,
    onDismiss: () => void,
};

export const EditIssue = ({ issue: init, lists, favorites, baseUrl, onSubmit, onDelete, onChangeFavorites, onDismiss }: EditEntryProps) => {
    const refs = useRef({
        projectSelect: undefined as HTMLInputElement,
        subjectInput: undefined as HTMLInputElement
    });
    const [issue, setIssue] = useState<Partial<IssueExt>>();
    const { id, project, tracker, status, allowed_statuses, priority, subject, description, category, is_private, estimated_hours, done_ratio, start_date, due_date } = issue || {} as IssueExt;

    const sort = <T extends { id: number }>(list: T[], favoriteIds: number[] = []): Array<T & { favorite: boolean }> => {
        const [favorites, rest] = list.reduce(([favorites, rest], item) => favoriteIds.includes(item.id) ? [[...favorites, item], rest] : [favorites, [...rest, item]], [[], []]);
        return [...favorites.map(item => ({ ...item, favorite: true })), ...rest];
    };
    const projects = useMemo(() => sort(lists.projects, favorites?.projects), [lists.projects, favorites?.projects]);
    const categories = useMemo(() => sort(project?.issue_categories || [], favorites?.categories), [project, favorites?.categories]);
    const trackers = useMemo(() => sort(project?.trackers || [], favorites?.trackers), [project, favorites?.trackers]);
    const priorities = useMemo(() => sort(lists.priorities, favorites?.priorities), [lists.priorities, favorites?.priorities]);
    const statuses = useMemo(() => sort(allowed_statuses || lists.statuses, favorites?.statuses), [allowed_statuses, lists.statuses, favorites?.statuses]);

    const propsProject = {
        placeholder: 'Project', value: project, values: projects, style: { width: 360 },
        render: (project: Project) => <div title={project.description}>{project.name}</div>,
        stringlify: (project: Project) => String(project.id),
        linkify: (project: Project) => `${baseUrl}/projects/${project.id}`,
        filter: (filter: RegExp) => (project: Project) => filter.test(project.name),
        onChange: (project: Project) => setIssue(issue => ({ ...issue, project })),
        onFavorite: (project: Project & { favorite: boolean }) => onChangeFavorites({
            ...favorites, projects: project.favorite ? (favorites?.projects || []).filter(id => id !== project.id) : (favorites?.projects || []).concat(project.id)
        })
    };

    const propsTracker = {
        placeholder: 'Tracker', value: tracker, values: trackers,
        render: (tracker: Tracker) => <div>{tracker.name}</div>,
        stringlify: (tracker: Tracker) => String(tracker.id),
        filter: (filter: RegExp) => (tracker: Tracker) => filter.test(tracker.name),
        onChange: (tracker: Tracker) => setIssue(issue => ({ ...issue, tracker })),
        onFavorite: (tracker: Tracker & { favorite: boolean }) => onChangeFavorites({
            ...favorites, trackers: tracker.favorite ? (favorites?.trackers || []).filter(id => id !== tracker.id) : (favorites?.trackers || []).concat(tracker.id)
        })
    };

    const propsCategory = {
        placeholder: 'Category', value: category, values: categories,
        render: (category: Category) => <div>{category.name}</div>,
        stringlify: (category: Category) => String(category.id),
        filter: (filter: RegExp) => (category: Category) => filter.test(category.name),
        onChange: (category: Category) => setIssue(issue => ({ ...issue, category })),
        onFavorite: (category: Category & { favorite: boolean }) => onChangeFavorites({
            ...favorites, categories: category.favorite ? (favorites?.categories || []).filter(id => id !== category.id) : (favorites?.categories || []).concat(category.id)
        })
    };

    const propsPriority = {
        placeholder: 'Priority', value: priority, values: priorities,
        render: (priority: Priority) => <div>{priority.name}</div>,
        stringlify: (priority: Priority) => String(priority.id),
        filter: (filter: RegExp) => (priority: Priority) => filter.test(priority.name),
        onChange: (priority: Priority) => setIssue(issue => ({ ...issue, priority })),
        onFavorite: (priority: Priority & { favorite: boolean }) => onChangeFavorites({
            ...favorites, priorities: priority.favorite ? (favorites?.priorities || []).filter(id => id !== priority.id) : (favorites?.priorities || []).concat(priority.id)
        })
    };

    const propsStatus = {
        placeholder: 'Status', value: status, values: statuses,
        render: (status: Status) => <div>{status.name}</div>,
        stringlify: (status: Status) => String(status.id),
        filter: (filter: RegExp) => (status: Status) => filter.test(status.name),
        onChange: (status: Status) => setIssue(issue => ({ ...issue, status })),
        onFavorite: (status: Status & { favorite: boolean }) => onChangeFavorites({
            ...favorites, priorities: status.favorite ? (favorites?.statuses || []).filter(id => id !== status.id) : (favorites?.statuses || []).concat(status.id)
        })
    };

    // const propsIssue = {
    //     placeholder: 'Issue', value: issue, values: issues,
    //     render: (issue: Issue, short: boolean) => short ?
    //         <div>#{issue.id} {issue.closed_on ? <del>{issue.subject}</del> : issue.subject}</div> :
    //         <div title={issue.description}>#{issue.id} {issue.project.name}<br />{issue.closed_on ? <del>{issue.subject}</del> : issue.subject}</div>,
    //     stringlify: (issue: Issue) => String(issue.id),
    //     linkify: (issue: Issue) => `${baseUrl}/issues/${issue.id}`,
    //     filter: hideInactive?.issues ?
    //         (filter: RegExp) => (issue: Issue) => !issue.closed_on && (filter.test(issue.subject) || filter.test(String(issue.id))) :
    //         (filter: RegExp) => (issue: Issue) => filter.test(issue.subject) || filter.test(String(issue.id)),
    //     onEdit: (value: string, issue: Issue) => console.log({ value, issue }),
    //     onChange: (issue: Issue) => setEntry(entry => ({ ...entry, issue, project: issue?.project })),
    //     onFavorite: (issue: Issue & { favorite: boolean }) => onChangeFavorites([
    //         favoriteProjectIds,
    //         issue.favorite ? favoriteIssueIds.filter(id => id !== issue.id) : favoriteIssueIds.concat(issue.id),
    //         favoriteActivities
    //     ]),
    //     onMount: (innerRefs: MutableRefObject<{ input: HTMLInputElement }>) => refs.current.issueSelect = innerRefs.current.input
    // };
    // const propsHours = {
    //     placeholder: 'Hours', value: hours || '', type: 'number', min: 0, max: 10, step: 0.25,
    //     onChange: event => setEntry(entry => ({ ...entry, hours: Number(event.target.value) }))
    // };
    // const propsActivity = {
    //     placeholder: 'Activity', value: activity, values: activities,
    //     render: (activity: Activity) => <div>{activity.active === false ? <del>{activity.name}</del> : activity.name}</div>,
    //     stringlify: (activity: Activity) => String(activity.id),
    //     filter: hideInactive?.activities ?
    //         (filter: RegExp) => (activity: Activity) => activity.active && filter.test(activity.name) :
    //         (filter: RegExp) => (activity: Activity) => filter.test(activity.name),
    //     onChange: (activity: Activity) => setEntry(entry => ({ ...entry, activity })),
    //     onFavorite: (activity: Activity & { favorite: boolean }) => onChangeFavorites([
    //         favoriteProjectIds, favoriteIssueIds,
    //         activity.favorite ? favoriteActivities.filter(id => id !== activity.id) : favoriteActivities.concat(activity.id)
    //     ]),
    // };
    const propsSubject = {
        placeholder: 'Subject', value: subject || '',
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setIssue(issue => ({ ...issue, subject: event.target.value }))
    };
    const propsDescription = {
        placeholder: 'Description', value: description || '',
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setIssue(issue => ({ ...issue, description: event.target.value }))
    };

    const propsEstimatedHours = {
        placeholder: 'Estimated', value: estimated_hours || '', type: 'number', min: 0, step: 0.25, css: { width: 80 },
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, estimated_hours: Number(event.target.value) }))
    };
    const propsDoneRatio = {
        placeholder: 'Done%', value: done_ratio || '', type: 'number', min: 0, max: 100, step: 10, css: { width: 80 },
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, done_ratio: Number(event.target.value) }))
    };
    const propsStartDate = {
        title: 'Start date', type: 'date', value: start_date || '',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, start_date: event.target.value }))
    };
    const propsDueDate = {
        title: 'Due date', type: 'date', value: due_date || '',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, due_date: event.target.value }))
    };

    const propsSubmit = {
        title: 'Submit', onClick: () => onSubmit({}) // TODO: !!!
    };
    const propsClose = {
        title: 'Close', onClick: () => onDismiss()
    };
    const propsDelete = {
        title: 'Delete', onClick: () => onDelete({ id })
    };

    useEffect(() => setIssue(init), [init]);
    useEffect(() => startTransition(() => issue ?
        window.localStorage.setItem('draft-issue', JSON.stringify(issue)) :
        window.localStorage.removeItem('draft-issue')), [issue]);
    return <Dialog show={init} title={id ? `#${id} issue` : `New issue`}>
        <div>
            <label title={'Project'}><FiPackage /></label>
            <Select {...propsProject} />
            <Select {...propsTracker} />
        </div>
        <hr />
        <div>
            <label title={'Subject'}><FiHash /></label>
            <Textarea {...propsSubject} />
        </div>
        <div>
            <label title={'Description'}><FiMessageSquare /></label>
            <Textarea {...propsDescription} />
        </div>
        <hr />
        <div>
            <label title={'Category'}><FiHash /></label>
            <Select {...propsStatus} />
            <Select {...propsPriority} />
            <Select {...propsCategory} />
        </div>
        <hr />
        <div>
            <label title={'Dates'}><FiClock /></label>
            <input {...propsStartDate} />
            <input {...propsDueDate} />
            {/* <input {...propsEstimatedHours} /> */}
            {/* <input {...propsDoneRatio} /> */}
        </div>
        <div>
            <button {...propsSubmit}><FiCheck /></button>
            <button {...propsClose}><FiX /></button>
            <Checkbox checked={false}>Assign to me</Checkbox>
            {id && <button {...propsDelete}><FiTrash2 /></button>}
        </div>
    </Dialog>;
};
