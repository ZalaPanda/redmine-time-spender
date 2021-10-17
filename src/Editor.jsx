import React, { useState, useRef } from 'react';
import { createUseStyles } from 'react-jss';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from 'react-spring';
import { Select } from './atoms/Select.jsx';
import { FiClock, FiHash, FiPackage, FiX, FiCheck, FiCopy, FiMinimize2, FiMaximize2, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { useAsyncEffect, useListen } from './storage.js';
import { Textarea } from './atoms/Textarea.jsx';

const useStyles = createUseStyles(theme => ({
    base: {
        position: 'fixed', zIndex: 1, width: 420, margin: 8, padding: 8,
        backgroundColor: theme.bg, border: [1, 'solid', theme.border], boxShadow: [0, 3, 9, theme.shadow]
    },
    title: {
        display: 'flex', alignItems: 'center', padding: [0, 10], backgroundColor: theme.dark, color: theme.textSoft, fontWeight: 'bold',
        userSelect: 'none', touchAction: 'none', cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
    },
    fields: {
        '&>div': {
            display: 'flex', alignItems: 'center', padding: 2,
            '&>label': { color: theme.specialBg }, // label with svg icon
            '&>div': { flexGrow: 1 }, // project, issue, activity
            '&>textarea': { color: theme.textSoft, flexGrow: 1 } // comments
        },
        '&>div:focus-within': {
            '&>label': { color: theme.textSoft }, // label with svg icon
        },
        '&>hr': { margin: [0, 10, 0, 30], border: 0, borderBottom: [1, 'solid', theme.border] }
    }
}));

export const Editor = ({ entry: init, lists: [projects, issues, activities], baseUrl, onSubmit, onDuplicate, onDismiss, onDelete }) => {
    const classes = useStyles();
    const refs = useRef({ issue: undefined });
    const [minimized, setMinimized] = useState(false);
    const [entry, setEntry] = useState();
    const { id, project, issue, activity, hours, comments, spent_on } = entry || {};
    const [{ y, scale }, setSpring] = useSpring(() => ({ y: -400, scale: 1, immediate: true, config: config.stiff }));

    const propsTitle = {
        ...useDrag(({ down, offset: [_, y] }) => setSpring.start({ y, scale: down ? 1.05 : 1 }), { delay: true, from: () => [0, y.get()] })()
    };
    const propsProject = {
        placeholder: 'Project', value: project, values: projects,
        render: item => <div title={item.description}>{item.name}</div>,
        stringlify: item => item.id,
        linkify: item => `${baseUrl}/projects/${item.id}`,
        filter: filter => item => filter.test(item.name),
        onChange: project => setEntry(entry => ({ ...entry, project, issue: undefined }))
    };
    const propsIssue = {
        placeholder: 'Issue', value: issue, values: issues,
        render: (item, short) => short ? (item.closed_on ? <strike>#{item.id} {item.subject}</strike> : <div>#{item.id} {item.subject}</div>) : <div title={item.description}>#{item.id} {item.project.name}<br />{item.subject}</div>,
        stringlify: item => item.id,
        linkify: item => `${baseUrl}/issues/${item.id}`,
        filter: filter => item => filter.test(item.subject) || filter.test(item.id),
        onChange: issue => setEntry(entry => ({ ...entry, issue, project: issue?.project || entry?.project })),
        onMount: innerRefs => refs.current.issue = innerRefs.current.input
    };
    const propsHours = {
        placeholder: 'Hours', value: hours || '', type: 'number', min: 0, max: 10, step: 0.25,
        onChange: event => setEntry(entry => ({ ...entry, hours: Number(event.target.value) }))
    };
    const propsActivity = {
        placeholder: 'Activity', value: activity, values: activities,
        render: item => <div>{item.name}</div>,
        stringlify: item => item.id,
        filter: filter => item => filter.test(item.name),
        onChange: activity => setEntry(entry => ({ ...entry, activity }))
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
        refs.current.issue.focus();
        await Promise.all(setSpring.start({ y: 0 }));
    }, [init]);
    useListen('unload', () => setEntry(entry => { // save current values to localStorage
        if (entry) window.localStorage.setItem('draft', JSON.stringify(entry));
        else window.localStorage.removeItem('draft');
        return entry;
    }));
    return <animated.div className={classes.base} style={{ y, scale }}>
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
