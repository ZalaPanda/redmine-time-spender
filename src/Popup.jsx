import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { JssProvider, createUseStyles } from 'react-jss';
import { useDrag, useHover } from 'react-use-gesture';
import { useSpring, animated, config } from 'react-spring';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import Select from './Select.jsx';
import { FiBook, FiClock, FiHash, FiPackage, FiX, FiChevronDown, FiPlus, FiCalendar, FiCheck, FiExternalLink, FiEdit, FiXSquare, FiCopy, FiMinimize2, FiMaximize2 } from 'react-icons/fi';
import { database, settings } from './storage.js';

dayjs.extend(duration);
dayjs.extend(relativeTime);

const setup = { days: 7, hours: [8, 16] };
const useStyles = createUseStyles({ // color codes: https://www.colorsandfonts.com/color-system
    '@font-face': [{
        fontFamily: 'WorkSans',
        src: 'url("font/work-sans-v11-latin-regular.woff2") format("woff2")',
    },
    {
        fontFamily: 'WorkSans',
        fontWeight: 'bold',
        src: 'url("font/work-sans-v11-latin-700.woff2") format("woff2")',
    }],
    '@global': {
        '*': { fontSize: '1rem', lineHeight: 1.625, fontFamily: ['WorkSans', 'Times New Roman', 'Verdana'] },
        'a': { color: '#3b82f6', '&:visited': { color: '#3b82f6' } },
        'svg': { margin: [0, 4], verticalAlign: 'baseline', strokeWidth: 2.5 },
        'html': { scrollBehavior: 'smooth', backgroundColor: '#121319', color: '#eee' },
        'input, textarea': { border: 'none', padding: [4, 6], boxSizing: 'border-box', backgroundColor: '#121319', color: '#eee', '&:focus': { outline: [1, 'solid', '#999'] } }, // , outline: 'none', 
        '::-webkit-scrollbar': { width: 8, height: 8 }, // https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, border: '2px solid white', backgroundColor: 'rgba(0,0,0,0.4)' },
        '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
        '::-webkit-resizer': { backgroundColor: 'transparent' }
    },
    bar: {
        position: 'relative', height: 12,
        '&>div': { position: 'absolute', display: 'flex', width: '100%', height: '100%' }
    },
    ellapsed: { backgroundColor: 'red', margin: [4, 0], boxSizing: 'border-box' },
    spent: { backgroundColor: 'green', border: [1, 'solid', '#333'], boxSizing: 'border-box' },
    row: {
        display: 'flex', flexDirection: 'row', flexWrap: 'wrap',
        '&>*': { flexShrink: 0, maxWidth: '100%', marginRight: '1em', marginBottom: 4, '&:hover': { backgroundColor: 'red' } }
    },
    focus: {
        backgroundColor: 'green',
        '&:focus': { backgroundColor: 'red' }
    },
    hours: {
        '&>button': {
            position: 'absolute', width: 0, height: 40, padding: 0, border: 'none', overflow: 'hidden', backgroundColor: 'transparent', color: 'white',
            '&:focus': { width: 40 }
        },
        '&:hover>button': { width: 40 }
    }
});

const Bar = ({ day, entries }) => {
    const classes = useStyles();
    const [start, end] = setup.hours;
    const today = dayjs().format('YYYY-MM-DD') === day;
    const all = end - start;
    const ellapsed = today ? dayjs().hour() - start : all;
    return <div className={classes.bar}>
        <div><div className={classes.ellapsed} style={{ width: `${ellapsed / all * 100}%` }}></div></div>
        <div>{entries && entries.filter(entry => entry.spent_on === day).map(({ id, hours, activity }) =>
            <div key={id} className={classes.spent} title={`${hours}h ${activity.name || '?'}`} style={{ width: `${hours / all * 100}%` }}></div>)}
        </div>
    </div>
};

const Textarea = (props) => {
    const element = useRef();
    useEffect(() => {
        element.current.style.height = '0px';
        element.current.style.height = `${element.current.scrollHeight}px`;
    }, [props.value]);
    return <textarea ref={element} {...props} />
}

const Timer = ({ start, times }) => {
    const display = useMemo(() => times.map(([start, duration]) => [
        dayjs(start).format(),
        dayjs(start).add(duration).format(),
        duration / 1000 / 60 / 60
    ]), [times]);
    const durations = useMemo(() => times.reduce((durations, [, duration]) => durations + duration, 0), [times]);
    const getDuration = () => start && dayjs().diff(start) || 0;
    const [duration, setDuration] = useState(getDuration());
    useEffect(() => {
        if (!start) return;
        const interval = setInterval(() => {
            setDuration(getDuration());
        }, 1000);
        return () => clearInterval(interval);
    }, [start]);
    return <>
        <FiClock title={dayjs(start).format('HH:mm')} />{((durations + duration) / 1000 / 60 / 60).toFixed(2)}h
        {/* [{ellapsed.toFixed(2)}] {diff * 60} */}
        {display.map(([start, end, duration]) => <div key={start}>{start} - {end} - {duration.toFixed(2)}h <FiX /></div>)}
    </>;
};

const Entry = ({ id, project, issue, spent_on, activity, hours, comments, onSelect }) => {
    const [focus, setFocus] = useState();
    const classes = useStyles();
    const onChange = (name) => (event, value) => setEntry(entry => ({ ...entry, [name]: event.target.value }))
    const [open, setOpen] = useState(false);
    // const bind = useHover()
    return <div style={{ margin: 2, border: '1px solid #333', padding: 8 }} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}>
        {/* onClick={() => setOpen(true)} */}
        <div className={classes.hours} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', float: 'left' }}>
            <svg height="50" width="50">
                <circle cx="25" cy="25" r="20.5" stroke="#263137" strokeWidth="6" fill="none" />
                <circle cx="25" cy="25" r="20.5" stroke="#50AF4C" strokeWidth="8" strokeDasharray={[16.1 * hours, 280]} fill="none" transform="rotate(-90,25,25)" />
            </svg>
            <b style={{ position: 'absolute' }}>{hours}h</b>
            <button onClick={onSelect}><FiEdit size={'2rem'} /></button>
        </div>
        <label style={{ backgroundColor: '#2E3C43', borderRadius: 4, padding: '0px 4px', float: 'right' }}>{activity.name}</label>
        <label>{project.name}{issue && <> <a href={'#'}>#{issue.id}</a> {issue.subject}</>}</label>
        <div style={{ color: '#888' }}>{comments}</div>
        {/* {!open && <div style={{ display: 'flex', flexDirection: 'column' }}>
            {focus && <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                <FiEdit tabIndex={0} /><FiCopy tabIndex={0} /><FiXSquare tabIndex={0} />
            </div>}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
                    <label><FiPackage />{project.name}<FiExternalLink /></label>
                    {issue && <label><a href={'#'}>#{issue.id}</a> {issue.subject}</label>}
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>
                    <label style={{ backgroundColor: '#2E3C43', borderRadius: 4, padding: '2px 4px', margin: '2px 4px' }}>{activity.name}</label>
                    <b>{hours}h</b>
                </div>
            </div>
            <div style={{ color: '#888' }}>{comments}</div>
        </div>}
        {open && <Editor entry={{ project, issue, spent_on, activity, hours, comments }} />} */}
    </div>
};

const Editor = ({ entry, onSubmit, onDismiss }) => {
    const classes = useStyles();
    const { projects, issues, activities } = useContext(DataContext);
    const [minimized, setMinimized] = useState(false);

    const [{ y }, api] = useSpring(() => ({ y: -300, config: config.stiff }));
    const bind = useDrag(({ movement: [_, y] }) => api.start({ y }), { axis: 'y', initial: () => [0, y.get()] });
    useEffect(async () => {
        setEntry(entry || {});
        api.start({
            to: async (next) => {
                await next({ y: -300 });
                entry && await next({ y: 0 });
            }
        });
    }, [entry]);

    const [{ id, project, issue, spent_on, activity, hours, comments }, setEntry] = useState({});
    return <animated.div style={{ position: 'fixed', zIndex: 1, width: 460, backgroundColor: '#263137', border: '1px solid red', margin: 20, padding: 5, y }}>
        <div {...bind()} style={{ display: 'flex', userSelect: 'none' }}>
            <label>{id || 'new'}</label>
            {minimized ? <FiMinimize2 onClick={() => setMinimized(false)} /> : <FiMaximize2 onClick={() => setMinimized(true)} />}
        </div>
        <div hidden={minimized}>
            <select>
                <option>option</option>
                <option>option1</option>
                <option>option2</option>
                <option>option3</option>
                <option>option4</option>
                <option>option5</option>
            </select>
            <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                <label><FiPackage /></label>
                <Select placeholder={'Project'}
                    focus={true}
                    style={{ flexGrow: 1 }}
                    value={project} values={projects}
                    render={item => <div title={item.description}>{item.name}</div>}
                    stringlify={item => item.id}
                    filter={filter => item => filter.test(item.name)}
                    onChange={({ id, name }) => setEntry(entry => ({ ...entry, project: { id, name }, issue: undefined }))} />
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #555' }} tabIndex={-1}>
                <label><FiHash /></label>
                <Select placeholder={'Issue'}
                    style={{ flexGrow: 1 }}
                    value={issue} values={issues}
                    render={(item, short) => short ? <div>#{item.id} {item.subject}</div> : <div title={item.description}>#{item.id} {item.project.name}<br />{item.subject}</div>}
                    stringlify={item => item.id}
                    filter={filter => item => filter.test(item.subject)}
                    onChange={issue => setEntry(entry => ({ ...entry, issue, project: issue?.project }))} />
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #555' }}>
                <label><FiCalendar /></label>
                <input type={'number'} placeholder={'Hours'} min={0} max={10} step={0.25} value={hours || ''} onChange={event => setEntry(entry => ({ ...entry, hours: event.target.value }))} />
                {/* <Select style={{ width: 80 }} placeholder={'Hours'}
                value={hours} values={[0.25, 0.5, 1, 1.5, 2]}
                onChange={hours => setEntry(entry => ({ ...entry, hours }))} /> */}
                <Select placeholder={'Activity'}
                    style={{ flexGrow: 1 }}
                    value={activity} values={activities}
                    render={item => <div>{item.name}</div>}
                    stringlify={item => item.id}
                    filter={filter => item => filter.test(item.name)}
                    onChange={({ id, name }) => setEntry(entry => ({ ...entry, activity: { id, name } }))} />
            </div>
            <Textarea onChange={event => setEntry(entry => ({ ...entry, comments: event.target.value }))} value={comments} style={{ color: '#777', width: '100%', resize: 'none', padding: 4, border: 'none', boxSizing: 'border-box' }} />
            <div>
                <input type={'date'} value={spent_on || ''} onChange={event => setEntry(entry => ({ ...entry, spent_on: event.target.value }))} />
                <button><FiCalendar /></button>
                <button onClick={() => onSubmit({ activity, hours, project, issue, comments })}><FiCheck /></button>
                <button onClick={() => onDismiss()}><FiX /></button>
            </div>
        </div>
    </animated.div>;
}

const DataContext = React.createContext()
const Test = () => {
    const { activities } = useContext(DataContext);
    const [toggle, setToggle] = useState(false);
    return <div>
        <button onClick={() => setToggle(toggle => !toggle)}>Click</button>
        {activities?.map(a => <li key={a.id}>{a.name}</li>)}
    </div>
};

const Day = ({ day, open, entries, onOpen, onEntrySelect }) => {
    const classes = useStyles();
    const [start, end] = setup.hours;
    const sum = end - start;
    const ellapsed = dayjs().format('YYYY-MM-DD') === day ? dayjs().hour() - start : sum;
    const hours = useMemo(() => entries.reduce((hours, entry) => hours + entry.hours || 0, 0), [entries]);
    return <>
        <div style={{ display: 'flex' }}>
            <label style={{ width: 100 }} onClick={onOpen(day)}>{day}</label>
            <b style={{ width: 50 }}>{hours}h</b>
            <div style={{ flexGrow: 1 }}>
                <div className={classes.bar}>
                    <div><div className={classes.ellapsed} style={{ width: `${ellapsed / sum * 100}%` }}></div></div>
                    <div>{entries && entries.map(({ id, hours, activity }) =>
                        <div key={id} className={classes.spent} title={`${hours}h ${activity.name || '?'}`} style={{ width: `${hours / sum * 100}%` }}></div>)}
                    </div>
                </div>
            </div>
        </div>
        {open && entries?.map(entry => <Entry key={entry.id} {...entry} onSelect={onEntrySelect(entry)} />)}
    </>
};

const useRaise = (type) => (detail) => window.dispatchEvent(new CustomEvent(type, { detail }));
const useListen = (type, callback = (_) => { }) => useEffect(() => {
    const listener = (event) => callback(event.detail);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
}, [callback]);

const Toast = () => {
    const [value, setValue] = useState();
    useListen('toast', (value) => setValue(value));
    return <div>{value}</div>;
}

const Popup = () => {
    // const [settings, setSettings] = useState();
    // useEffect(() => settings.get(), []);

    // 1: load settings =X=> open options
    // 2: load data from database =X=> fuck

    const [error, setError] = useState();
    const [entries, setEntries] = useState();
    const [tasks, setTasks] = useState();
    const data = useRef({ issues: [], projects: [], activities: [], settings: {} });
    // const settings = data.current.settings;
    const days = [...Array(setup.days)].map((_, day) => dayjs().subtract(day, 'day').format('YYYY-MM-DD')) || [];
    const [day, setDay] = useState(dayjs().format('YYYY-MM-DD'));
    const [open, setOpen] = useState(days[0]);
    const raiseToast = useRaise('toast');
    const onTest = () => {
        // raiseToast('testing');
        chrome.runtime.sendMessage({ type: 'refresh' }, (response) => {
            console.log(response);
        });
        // chrome.runtime.sendMessage({ type: 'test' }, (response) => {
        //     console.log(response);
        // });
    };
    const [entry, setEntry] = useState({});
    const onEntrySelect = (entry) => () => setEntry(entry);

    const onMessage = (message, sender) => {
        if (sender.id !== chrome.runtime.id) return;
        console.log({ message });
        // if (message.entries) setEntries(message.entries);
        // if (message.tasks) setTasks(message.tasks);
        // if (message.error) setError(message.error.toString());
        // if (message.issues) data.current.issues = message.issues;
        // if (message.projects) data.current.projects = message.projects;
        // if (message.activities) data.current.activities = message.activities;
    };
    const onOpen = (day) => () => setOpen(day);

    // const check = async () => {
    //     https://redmine.bhu.flextronics.com/my/account.json
    // };
    const refresh = async () => {
        const tasks = await database.table('tasks').toArray();
        const raw_entries = await database.table('entries').toArray();
        const entry_issues = await database.table('issues').bulkGet([...new Set(raw_entries.filter(entry => entry.issue).map(entry => entry.issue.id))]);
        const entries = raw_entries.map(entry => ({ ...entry, issue: entry.issue && entry_issues.find(issue => issue.id === entry.issue.id) }))
        const issues = await database.table('issues').filter(issue => !issue.closed_on).toArray();
        const activities = await database.table('activities').toArray();
        const projects = await database.table('projects').toArray();
        const all = await settings.get();
        console.log(all);
        const { url, key, days, hours } = await settings.get(['url', 'key', 'days', 'hours']);
        data.current = { issues, activities, projects, settings: { url, key, days, hours } };
        setEntries(entries); // NOTE: bached updates in React 19
        setTasks(tasks);
    };
    useEffect(() => {
        refresh();
        chrome.runtime.onMessage.addListener(onMessage);
        return () => chrome.runtime.onMessage.removeListener(onMessage);
    }, []);
    const values = [{ id: 1, name: 'one' }, { id: 2, name: 'two' }, { id: 3, name: 'three very long' }];
    const [value, setValue] = useState();
    const onValueChange = (value) => {
        setValue(value);
    };
    return <JssProvider id={{ minify: false }}>
        <DataContext.Provider value={data.current}>
            <div style={{ width: 460 }}>
                <Editor entry={entry} onDismiss={onEntrySelect()} />
                <button onClick={onTest}>Test</button>
                <button onClick={() => raiseToast('testing2')}>Task</button>
                <button style={{ backgroundColor: '#999' }}>Time</button>
                {days.map(day => <Day key={day} day={day} open={day === open} onOpen={onOpen} onEntrySelect={onEntrySelect} entries={entries?.filter(entry => entry.spent_on === day) || []} />)}
                {/* {days.map(day => <div key={day}>
                    <span onClick={onOpen(day)}>{day}</span>
                    <Bar day={day} entries={entries} />
                    {open === day && entries && entries.filter(entry => entry.spent_on === day).map(entry => <Entry key={entry.id} {...entry} projects={projects} issues={issues} activities={activities} />)}
                </div>)} */}
                {/* ... <input value={filter || ''} onChange={onFilterChange} /><button onClick={onSearch}>Test</button> */}
                {/* {entries && entries.map(({ id, hours, comments }) => <div key={id}>#{id} [{hours}] {comments}</div>)} */}
                {/* <Select style={{ width: 300 }} placeholder={'Number'} value={value} values={projects} render={item => <div title={item?.description}>{item?.name}</div>} stringlify={item => item?.id} filter={filter => item => filter.test(item?.name)} onChange={onValueChange} /> */}
                {/* <Select style={{ width: 200 }} placeholder={'Issue'} values={issues} render={item => item?.id} stringlify={item => item?.id} filter={filter => item => filter.test(item?.name)} onChange={onValueChange} /> */}
                {/* <select>{issues && issues.map(issue => <option>{issue.id}</option>)}</select> */}
                {/* {projects?.map(project => <div key={project.id}>{project.name}</div>)} */}
                {/* {error && <pre>{error}</pre>} */}
                {/* <Timer start={1630267513756} times={[
                    [1630267513756, 1313000],
                    [1630267503756, 1413000],
                    [1630267413756, 1813000]]} /> */}
                {/* <Test></Test> */}
            </div>
            <Toast />
        </DataContext.Provider>
    </JssProvider>;
};

export default Popup;