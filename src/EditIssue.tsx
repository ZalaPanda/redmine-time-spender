import { useState, useRef, useMemo, useEffect, startTransition, ChangeEvent, FocusEvent, MutableRefObject } from 'react';
import { useSpring, animated, config } from '@react-spring/web';
import { useHover } from '@use-gesture/react';
import { css, Theme } from '@emotion/react';
import { margin, padding } from 'polished';
import { FiHash, FiPackage, FiX, FiCheck, FiMessageSquare, FiCalendar, FiChevronsRight, FiBookmark, FiInfo, FiTrendingUp, FiMenu, FiExternalLink } from 'react-icons/fi';

import { Category, CustomField, Issue, IssueExt, Priority, Project, Status, Tracker } from './apis/redmine';
import { useRaise } from './apis/uses';

import { Favorites, Lists } from './App';
import { Dialog } from './Dialog';
import { Checkbox } from './atoms/Checkbox';
import { Select } from './atoms/Select';
import { Textarea } from './atoms/Textarea';

interface EditEntryProps {
    issue: Partial<IssueExt>,
    lists: Lists,
    favorites: Favorites,
    baseUrl?: string,
    hideInactive?: { priorities: boolean },
    onSubmit: (entry: Partial<Issue>) => void,
    onChangeFavorites: (favorites: Favorites) => void,
    onDismiss: () => void,
};

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

const pagerContainerStyles = css({
    whiteSpace: 'nowrap', overflowX: 'clip',
    '&>div': { display: 'inline-block', width: '100%', verticalAlign: 'top' }
});

const pagerCircleStyles = (theme: Theme) => css({
    display: 'flex', justifyContent: 'center', height: 6,
    '&>svg': { fill: theme.button.hover, cursor: 'pointer' },
    '&>svg[active]': { fill: theme.button.active }
});

const numericInputStyles = (theme: Theme) => css({
    width: 60,
    ...padding(2, 6), borderRadius: 4, borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent',
    '&[success]': { borderColor: theme.success },
    '&[danger]': { borderColor: theme.danger }
});

export const EditIssue = ({ issue: init, lists, favorites, baseUrl, hideInactive, onSubmit, onChangeFavorites, onDismiss }: EditEntryProps) => {
    const uniqueKey = useMemo(() => init ? Date.now() : undefined, [init]);
    const refs = useRef({
        projectSelect: undefined as HTMLInputElement,
        subjectInput: undefined as HTMLInputElement
    });

    const raiseHideSelect = useRaise('hide-select'); // NOTE: check Select.tsx:184
    const [visiblePage, setVisiblePage] = useState(0);
    const [{ x }, setSpring] = useSpring(() => ({ x: `0%`, immediate: true, config: config.stiff }), []);

    const pagerContainerProps = {
        css: pagerContainerStyles
    };
    const pagerPageProps = (page: number) => ({
        onFocus: () => setVisiblePage(page),
        css: fieldsStyles,
        style: { x }
    });
    const pagerDotProps = (page: number) => ({
        width: 6, height: 6, active: page === visiblePage ? 'true' : null,
        ...useHover(({ hovering, args: [page] }) => hovering && setVisiblePage(page), {})(page)
    });

    useEffect(() => {
        raiseHideSelect();
        setSpring.start({ x: `${-100 * visiblePage}%` })
    }, [visiblePage]);

    const [issue, setIssue] = useState<Partial<IssueExt>>();
    const { id, project, tracker, status, allowed_statuses, priority, subject, description, category, is_private, assigned_to, custom_fields, spent_hours, estimated_hours, done_ratio, start_date, due_date } = issue || {} as IssueExt;

    const sort = <T extends { id: number }>(list: T[], favoriteIds: number[] = []): Array<T & { favorite: boolean }> => {
        const [favorites, rest] = list.reduce(([favorites, rest], item) => favoriteIds.includes(item.id) ? [[...favorites, item], rest] : [favorites, [...rest, item]], [[], []]);
        return [...favorites.map(item => ({ ...item, favorite: true })), ...rest];
    };
    const projects = useMemo(() => sort(lists.projects, favorites?.projects), [lists.projects, favorites?.projects]);
    const categories = useMemo(() => sort(project?.issue_categories || [], favorites?.categories), [project, favorites?.categories]);
    const trackers = useMemo(() => sort(project?.trackers || [], favorites?.trackers), [project, favorites?.trackers]);
    const priorities = useMemo(() => sort(lists.priorities, favorites?.priorities), [lists.priorities, favorites?.priorities]);
    const statuses = useMemo(() => sort(allowed_statuses || lists.statuses, favorites?.statuses), [allowed_statuses, lists.statuses, favorites?.statuses]);

    const dialogProps = {
        show: init,
        title: id ? `#${id} issue` : `New issue`,
        onShow: () => id ? refs.current.subjectInput.focus() : refs.current.projectSelect.focus()
    };
    const propsProject = {
        placeholder: 'Project', value: project, values: projects, style: { width: 360 },
        render: (project: Project) => <div title={project.description}>{project.name}</div>,
        stringlify: (project: Project) => String(project.id),
        linkify: (project: Project) => `${baseUrl}/projects/${project.id}`,
        filter: (filter: RegExp) => (project: Project) => filter.test(project.name),
        onChange: (project: Project) => setIssue(issue => ({
            ...issue, project, custom_fields: project?.issue_custom_fields?.length ?
                project.issue_custom_fields.map(({ id, name }) => custom_fields?.find(field => field.id === id) || { id, name, value: undefined }) : []
        })),
        onFavorite: (project: Project & { favorite: boolean }) => onChangeFavorites({
            ...favorites, projects: project.favorite ? (favorites?.projects || []).filter(id => id !== project.id) : (favorites?.projects || []).concat(project.id)
        }),
        onMount: (innerRefs: MutableRefObject<{ input: HTMLInputElement }>) => refs.current.projectSelect = innerRefs.current.input
    };
    const propsIsPrivate = {
        checked: is_private,
        onChange: (is_private: boolean) => setIssue(issue => ({ ...issue, is_private }))
    };
    const propsAssignToMe = {
        checked: assigned_to?.name === 'me',
        onChange: (me: boolean) => setIssue(issue => ({ ...issue, assigned_to: me ? { id: 0, name: 'me' } : undefined }))
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
        filter: hideInactive?.priorities ?
            (filter: RegExp) => (priority: Priority) => priority.active && filter.test(priority.name) :
            (filter: RegExp) => (priority: Priority) => filter.test(priority.name),
        onChange: (priority: Priority) => setIssue(issue => ({ ...issue, priority })),
        onFavorite: (priority: Priority & { favorite: boolean }) => onChangeFavorites({
            ...favorites, priorities: priority.favorite ? (favorites?.priorities || []).filter(id => id !== priority.id) : (favorites?.priorities || []).concat(priority.id)
        })
    };
    const propsStatus = {
        placeholder: 'Status', value: status, values: statuses,
        render: (status: Status) => status.is_closed ? <del>{status.name}</del> : <div>{status.name}</div>,
        stringlify: (status: Status) => String(status.id),
        filter: (filter: RegExp) => (status: Status) => filter.test(status.name),
        onChange: (status: Status) => setIssue(issue => ({ ...issue, status })),
        onFavorite: (status: Status & { favorite: boolean }) => onChangeFavorites({
            ...favorites, priorities: status.favorite ? (favorites?.statuses || []).filter(id => id !== status.id) : (favorites?.statuses || []).concat(status.id)
        })
    };
    const propsSubject = {
        placeholder: 'Subject', value: subject || '',
        ref: (ref: HTMLInputElement) => refs.current.subjectInput = ref,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, subject: event.target.value }))
    };
    const propsDescription = {
        placeholder: 'Description', key: uniqueKey, defaultValue: description || '',
        onBlur: (event: FocusEvent<HTMLTextAreaElement>) => setIssue(issue => ({ ...issue, description: event.target.value }))
    };
    const propsStartDate = {
        title: 'Start date', type: 'date', value: start_date || '',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, start_date: event.target.value }))
    };
    const propsDueDate = {
        title: 'Due date', type: 'date', value: due_date || '',
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, due_date: event.target.value }))
    };
    const propsCustomField = ({ id, name, value, multiple }: CustomField) => ({
        placeholder: name, key: uniqueKey, defaultValue: multiple && Array.isArray(value) ? value.join('\r\n') : String(value || ''),
        onBlur: (event: FocusEvent<HTMLTextAreaElement>) => setIssue(issue => ({
            ...issue, custom_fields: issue.custom_fields.map(custom_field => custom_field.id === id ?
                ({ ...custom_field, value: custom_field.multiple ? event.target.value.split(/\r\n|\r|\n/) : event.target.value }) : custom_field)
        }))
    });
    const propsEstimatedHours = {
        placeholder: 'Hours', value: estimated_hours || '', type: 'number', min: 0, step: 0.25, css: numericInputStyles,
        title: spent_hours ? `Spent hours: ${spent_hours}` : 'Estimated Hours', danger: spent_hours > estimated_hours ? '' : null,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, estimated_hours: Number(event.target.value) }))
    };
    const propsDoneRatio = {
        placeholder: '%', value: done_ratio || '', type: 'number', min: 0, max: 100, step: 10, css: numericInputStyles,
        title: '% Done', success: done_ratio === 100 ? '' : null,
        onChange: (event: ChangeEvent<HTMLInputElement>) => setIssue(issue => ({ ...issue, done_ratio: Number(event.target.value) }))
    };

    const propsSubmit = {
        title: 'Submit', onClick: () => onSubmit(issue)
    };
    const propsLink = {
        title: 'Link', onClick: () => chrome.tabs.create({ url: `${baseUrl}/issues/${id}`, active: false })
    };
    const propsClose = {
        title: 'Close', onClick: () => onDismiss()
    };

    useEffect(() => setIssue(init), [init]);
    useEffect(() => startTransition(() => issue ?
        window.localStorage.setItem('draft-issue', JSON.stringify(issue)) :
        window.localStorage.removeItem('draft-issue')), [issue]);
    return <Dialog {...dialogProps}>
        <div {...pagerContainerProps}>
            <animated.div {...pagerPageProps(0)}>
                <div>
                    <label title={'Project'}><FiPackage /></label>
                    <Select {...propsProject} />
                    <Checkbox {...propsIsPrivate}>Private</Checkbox>
                </div>
                <hr />
                <div>
                    <label title={'Tracker/Priority/Status'}><FiMenu /></label>
                    <Select {...propsTracker} />
                    <Select {...propsPriority} />
                    <Select {...propsStatus} />
                </div>
                <hr />
                <div>
                    <label title={'Subject'}><FiHash /></label>
                    <input {...propsSubject} />
                </div>
                <hr />
                <div>
                    <label title={'Description'}><FiMessageSquare /></label>
                    <Textarea {...propsDescription} />
                </div>
            </animated.div>
            <animated.div {...pagerPageProps(1)}>
                <div>
                    <label title={'Start date'}><FiCalendar /></label>
                    <input {...propsStartDate} />
                    <label title={'Due date'}><FiChevronsRight /></label>
                    <input {...propsDueDate} />
                </div>
                <hr />
                {categories?.length ? <><div>
                    <label title={'Category'}><FiBookmark /></label>
                    <Select {...propsCategory} />
                </div><hr /></> : null}
                {custom_fields?.length ? custom_fields.map(({ id, name, value, multiple }) => <div key={id}>
                    <label title={name}><FiInfo /></label>
                    <Textarea {...propsCustomField({ id, name, value, multiple })} />
                </div>) : null}
            </animated.div>
        </div>
        <div css={pagerCircleStyles}>
            <svg {...pagerDotProps(0)}>
                <circle cx={3} cy={3} r={3} />
            </svg>
            <svg {...pagerDotProps(1)}>
                <circle cx={3} cy={3} r={3} />
            </svg>
        </div>
        <div css={fieldsStyles}>
            <div>
                <button {...propsSubmit}><FiCheck /></button>
                <button {...propsClose}><FiX /></button>
                {id && <button {...propsLink}><FiExternalLink /></button>}
                {!id && <Checkbox {...propsAssignToMe}>Assign to me</Checkbox>}
                <div />
                <label title={'Estimate/Done'}><FiTrendingUp /></label>
                <input {...propsEstimatedHours} />
                <input {...propsDoneRatio} />
            </div>
        </div>
    </Dialog>;
};
