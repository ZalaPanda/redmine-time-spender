import React, { useState, useRef, useMemo } from 'react';
import { createUseStyles } from 'react-jss';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import { Select } from './atoms/Select.jsx';
import { FiClock, FiHash, FiPackage, FiX, FiCheck, FiCopy, FiMinimize2, FiMaximize2, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { useAsyncEffect, useListen } from './apis/uses.js';
import { Textarea } from './atoms/Textarea.jsx';

const useStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    editor: {
        position: 'fixed', zIndex: 1, width: 420, margin: 8, padding: 8,
        backgroundColor: theme.bg, border: [1, 'solid', theme.border], boxShadow: [0, 3, 9, theme.shadow]
    },
    title: {
        display: 'flex', alignItems: 'center', padding: [0, 10], backgroundColor: theme.title.bg, color: theme.title.text, fontWeight: 'bold',
        userSelect: 'none', touchAction: 'none', cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
    },
    fields: {
        '&>div': {
            display: 'flex', alignItems: 'center', padding: 2,
            '&>label': { color: theme.field.text }, // label with svg icon
            '&>div': { flexGrow: 1 }, // project, issue, activity
            '&>textarea': { color: theme.muted, flexGrow: 1 } // comments
        },
        '&>div:focus-within': {
            '&>label': { color: theme.field.focus }, // label with svg icon
        },
        '&>hr': { margin: [0, 10, 0, 30], border: 0, borderBottom: [1, 'solid', theme.border] }
    }
}));

export const Editor = ({ entry: init, lists, favorites, baseUrl, onSubmit, onDuplicate, onChangeFavorites, onDismiss, onDelete }) => {
    const classes = useStyles();
    const refs = useRef({ issueSelect: undefined });
    const [minimized, setMinimized] = useState(false);
    const [entry, setEntry] = useState();
    const { id, project, issue, activity, hours, comments, spent_on } = entry || {};
    const [{ y, scale }, setSpring] = useSpring(() => ({ y: -400, scale: 1, immediate: true, config: config.stiff }));

    const [rawProjects = [], rawIssues = [], rawActivities = []] = lists ?? [];
    const [favoriteProjectIds = [], favoriteIssueIds = [], favoriteActivities = []] = favorites ?? [];

    const sort = (list, favoriteIds) => {
        const [favorites, rest] = list.reduce(([favorites, rest], item) => favoriteIds.includes(item.id) ? [[...favorites, item], rest] : [favorites, [...rest, item]], [[], []]);
        return [...favorites.map(item => ({ ...item, favorite: true })), ...rest];
    };
    const projects = useMemo(() => sort(rawProjects, favoriteProjectIds), [rawProjects, favoriteProjectIds]);
    const issues = useMemo(() => sort(project ? rawIssues.filter(issue => issue.project.id === project.id) : rawIssues, favoriteIssueIds), [rawIssues, favoriteIssueIds, project]);
    const activities = useMemo(() => sort(rawActivities, favoriteActivities), [rawActivities, favoriteActivities]);

    const propsTitle = {
        ...useDrag(({ down, offset: [_, y] }) => setSpring.start({ y, scale: down ? 1.05 : 1 }), { delay: true, from: () => [0, y.get()] })()
    };
    const propsProject = {
        placeholder: 'Project', value: project, values: projects,
        render: project => <div title={project.description}>{project.name}</div>,
        stringlify: project => project.id,
        linkify: project => `${baseUrl}/projects/${project.id}`,
        filter: filter => project => filter.test(project.name),
        onChange: project => setEntry(entry => ({ ...entry, project, issue: undefined })),
        onFavorite: project => onChangeFavorites([
            project.favorite ? favoriteProjectIds.filter(id => id !== project.id) : favoriteProjectIds.concat(project.id),
            favoriteIssueIds, favoriteActivities
        ])
    };
    const propsIssue = {
        placeholder: 'Issue', value: issue, values: issues,
        render: (issue, short) => short ?
            <div>#{issue.id} {issue.closed_on ? <strike>{issue.subject}</strike> : issue.subject}</div> :
            <div title={issue.description}>#{issue.id} {issue.project.name}<br />{issue.closed_on ? <strike>{issue.subject}</strike> : issue.subject}</div>,
        stringlify: issue => issue.id,
        linkify: issue => `${baseUrl}/issues/${issue.id}`,
        filter: filter => issue => filter.test(issue.subject) || filter.test(issue.id),
        onChange: issue => setEntry(entry => ({ ...entry, issue, project: issue?.project })),
        onFavorite: issue => onChangeFavorites([
            favoriteProjectIds,
            issue.favorite ? favoriteIssueIds.filter(id => id !== issue.id) : favoriteIssueIds.concat(issue.id),
            favoriteActivities
        ]),
        onMount: innerRefs => refs.current.issueSelect = innerRefs.current.input
    };
    const propsHours = {
        placeholder: 'Hours', value: hours || '', type: 'number', min: 0, max: 10, step: 0.25,
        onChange: event => setEntry(entry => ({ ...entry, hours: Number(event.target.value) }))
    };
    const propsActivity = {
        placeholder: 'Activity', value: activity, values: activities,
        render: activity => <div>{activity.name}</div>,
        stringlify: activity => activity.id,
        filter: filter => activity => filter.test(activity.name),
        onChange: activity => setEntry(entry => ({ ...entry, activity })),
        onFavorite: activity => onChangeFavorites([
            favoriteProjectIds, favoriteIssueIds,
            activity.favorite ? favoriteActivities.filter(id => id !== activity.id) : favoriteActivities.concat(activity.id)
        ]),
    };
    const propsComments = {
        placeholder: 'Comments', value: comments || '',
        onChange: event => setEntry(entry => ({ ...entry, comments: event.target.value }))
    };
    const propsSpentOn = {
        title: 'Spent on', type: 'date', value: spent_on || '',
        onChange: event => setEntry(entry => ({ ...entry, spent_on: event.target.value }))
    };
    const propsMinimize = {
        title: minimized ? 'Maximize' : 'Minimize', onClick: _ => setMinimized(minimized => !minimized)
    };
    const propsSubmit = {
        title: 'Submit', onClick: _ => onSubmit({ id, project, issue, hours, activity, comments, spent_on })
    };
    const propsDuplicate = {
        title: 'Duplicate', onClick: _ => onDuplicate({ project, issue, hours, activity, comments, spent_on })
    }
    const propsClose = {
        title: 'Close', onClick: _ => onDismiss()
    }
    const propsDelete = {
        title: 'Delete', onClick: _ => onDelete({ id })
    }

    useAsyncEffect(async ({ aborted }) => { // animation and autofocus on entry change
        await Promise.all(setSpring.start({ y: -400 }));
        if (aborted) return;
        setEntry(init);
        if (!init) return;
        refs.current.issueSelect.focus();
        await Promise.all(setSpring.start({ y: 0 }));
    }, [init]);
    useListen('unload', () => setEntry(entry => { // save current values to localStorage
        if (entry) window.localStorage.setItem('draft', JSON.stringify(entry));
        else window.localStorage.removeItem('draft');
        return entry;
    }));
    return <animated.div className={classes.editor} style={{ y, scale }}>
        <div className={classes.title} {...propsTitle}>
            <label>{id ? 'Edit time entry' : 'New time entry'}</label>
            <button {...propsMinimize}>{minimized ? <FiMinimize2 /> : <FiMaximize2 />}</button>
        </div>
        <div hidden={minimized} className={classes.fields}>
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
    </animated.div>;
};
