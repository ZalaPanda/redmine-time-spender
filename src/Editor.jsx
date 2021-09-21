import React, { useState, useEffect, useRef } from 'react';
import { createUseStyles } from 'react-jss';
import { useDrag } from 'react-use-gesture';
import { useSpring, animated, config } from 'react-spring';
import Select from './Select.jsx';
import { FiClock, FiHash, FiPackage, FiX, FiCheck, FiCopy, FiMinimize2, FiMaximize2, FiTrash2 } from 'react-icons/fi';
import { database, useAsyncEffect } from './storage.js';

const useStyles = createUseStyles(theme => ({
    base: {
        position: 'fixed', zIndex: 1, width: 460, backgroundColor: theme.background, border: [1, 'solid', theme.gray200], margin: 8, padding: 8,
        '&>div:first-child': {
            display: 'flex', alignItems: 'center', padding: [0, 10], userSelect: 'none', cursor: 'grab', backgroundColor: theme.gray50, color: theme.gray850, fontWeight: 'bold',
            '&:active': { cursor: 'grabbing' }
        },
    },
    fields: {
        '&>div': {
            display: 'flex', alignItems: 'center', padding: 2, borderTop: [1, 'solid', theme.gray50],
            '&>label': { color: theme.gray400 }, // label with svg icon
            '&>div': { flexGrow: 1 }, // project, issue, activity
            '&>textarea': { flexGrow: 1, color: '#888' } // comments
        },
        '&>div:focus-within': {
            '&>label': { color: theme.gray850 }, // label with svg icon
        }
    }
}));

const Textarea = (props) => {
    const element = useRef();
    useEffect(() => {
        element.current.style.height = '0px'; // reset height
        element.current.style.height = element.current.scrollHeight && `${element.current.scrollHeight}px` || ''; // set scroll height
    }, [props.value]);
    return <textarea ref={element} {...props} />
};

export const Editor = ({ entry, url, onSubmit, onDuplicate, onDismiss, onDelete }) => {
    const classes = useStyles();
    const lists = useRef({ projects: [], issues: [], activities: [] });
    const { current: { projects, issues, activities } } = lists;
    const [minimized, setMinimized] = useState(false);

    const [{ y, scale }, setSprings] = useSpring(() => ({ y: -300, scale: 1, config: config.stiff }));
    const bind = useDrag(({ down, movement: [_, y] }) => setSprings.start({ y, scale: down ? 1.05 : 1 }), { delay: true, initial: () => [0, y.get()] });
    useAsyncEffect(async () => {
        lists.current.projects = await database.table('projects').toArray();
        lists.current.issues = await database.table('issues').filter(issue => !issue.closed_on).toArray();
        lists.current.activities = await database.table('activities').toArray();
    }, undefined, []);
    useAsyncEffect(async () => {
        setEntry(entry || {});
        setSprings.start({
            to: async (next) => {
                await next({ y: -300 });
                entry && await next({ y: 0 });
            }
        });
    }, undefined, [entry]);

    const [{ id, project, issue, activity, hours, comments, spent_on }, setEntry] = useState({});
    return <animated.div className={classes.base} style={{ y, scale }}>
        <div {...bind()}>
            <label>{id ? 'Edit time entry' : 'New time entry'}</label>
            <button onClick={() => setMinimized(m => !m)}>{minimized ? <FiMinimize2 /> : <FiMaximize2 />}</button>
        </div>
        <div hidden={minimized} className={classes.fields}>
            <div>
                <label title={'Project'}><FiPackage /></label>
                <Select placeholder={'Project'}
                    value={project} values={projects}
                    render={item => <div title={item.description}>{item.name}</div>}
                    stringlify={item => item.id}
                    linkify={item => `${url}/projects/${item.id}`}
                    filter={filter => item => filter.test(item.name)}
                    onChange={project => setEntry(entry => ({ ...entry, project, issue: undefined }))} />
            </div>
            <div>
                <label title={'Issue'}><FiHash /></label>
                <Select placeholder={'Issue'}
                    focus={id} // TODO: check this
                    value={issue} values={issues}
                    render={(item, short) => short ? <div>#{item.id} {item.subject}</div> : <div title={item.description}>#{item.id} {item.project.name}<br />{item.subject}</div>}
                    stringlify={item => item.id}
                    linkify={item => `${url}/issues/${item.id}`}
                    filter={filter => item => filter.test(item.subject) || filter.test(item.id)}
                    onChange={issue => setEntry(entry => ({ ...entry, issue, project: issue?.project || entry.project }))} />
            </div>
            <div>
                <label title={'Hours'}><FiClock /></label>
                <input placeholder={'Hours'} type={'number'}
                    min={0} max={10} step={0.25}
                    value={hours || ''} onChange={event => setEntry(entry => ({ ...entry, hours: event.target.value }))} />
                <Select placeholder={'Activity'}
                    value={activity} values={activities}
                    render={item => <div>{item.name}</div>}
                    stringlify={item => item.id}
                    filter={filter => item => filter.test(item.name)}
                    onChange={activity => setEntry(entry => ({ ...entry, activity }))} />
            </div>
            <div>
                <Textarea placeholder={'Comments'}
                    value={comments || ''} onChange={event => setEntry(entry => ({ ...entry, comments: event.target.value }))} />
            </div>
            <div>
                <button title={'Submit'} onClick={() => onSubmit({ id, project, issue, hours, activity, comments, spent_on })}><FiCheck /></button>
                <button title={'Duplicate'} onClick={() => onDuplicate({ project, issue, hours, activity, comments, spent_on })}><FiCopy /></button>
                <button title={'Close'} onClick={() => onDismiss()}><FiX /></button>
                <div><input title={'Spent on'} type={'date'}
                    value={spent_on || ''} onChange={event => setEntry(entry => ({ ...entry, spent_on: event.target.value }))} /></div>
                <button title={'Delete'} onClick={() => onDelete({ id })}><FiTrash2 /></button>
            </div>
        </div>
    </animated.div>;
}
