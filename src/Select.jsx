import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGesture } from 'react-use-gesture';
import { createUseStyles } from 'react-jss';
import { FiChevronDown, FiChevronsDown, FiExternalLink, FiX } from 'react-icons/fi';

const useStyles = createUseStyles({
    base: {
        display: 'inline-block', position: 'relative',
        '&>input': { width: '100%', border: [1, 'solid', 'transparent'], borderRadius: 4, padding: 4, boxSizing: 'border-box' },
        '&>label': {
            position: 'absolute', display: 'flex', alignItems: 'center', pointerEvents: 'none',
            width: '100%', height: '100%', border: [1, 'solid', 'transparent'], padding: 4, boxSizing: 'border-box',
            '&>div': { flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            '&>svg': { flexShrink: 0, pointerEvents: 'auto' },
        },
        '&>div': {
            position: 'absolute', zIndex: 1,
            padding: 0, margin: 0,
            maxHeight: 200, overflowY: 'auto',
            width: '100%', borderRadius: 4, boxShadow: '0 3px 9px rgb(0 0 0 / 50%)',
            display: 'flex', flexDirection: 'column',
            color: '#000', backgroundColor: '#fff',
            '&:hidden': { display: 'none' },
            '&>div': { flexShrink: 0, padding: [4, 6], cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            '&>div[active]': { borderLeft: '4px solid #80bdff', backgroundColor: '#eee' }
        }
    }
});

const step = 20;
const tolerance = 50;

const Select = ({ value: current, values, placeholder, focus, stringlify = value => value, render = value => value, filter = exp => value => exp.test(value), onChange = value => { }, ...props }) => {
    const classes = useStyles();
    const refs = useRef({ input: undefined, list: undefined, timeout: undefined });
    const [limit, setLimit] = useState(step);
    const [search, setSearch] = useState({ value: '', index: -1, active: false });
    const filtered = useMemo(() => {
        const exp = RegExp((search.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // https://stackoverflow.com/a/6969486
        return values?.filter(filter(exp)) || [];
    }, [search.value, values]);

    const getIndex = (filtered, index, diff) => filtered[index + diff] ? index + diff : diff < 0 ? 0 : index;
    const setValue = (value) => {
        value !== current && onChange(value);
        setSearch({ value: '', index: -1, active: false });
        refs.current.input.focus();
    };

    const propsBase = ({
        onBlur: () => refs.current.timeout = setTimeout(() => setSearch(search => ({ ...search, active: false })), 100), // -> start list hide timeout
        onFocus: () => clearTimeout(refs.current.timeout), // -> cancel list hide timeout
        tabIndex: -1, // needed to detect focus/blur events
        className: classes.base,
        ...props
    });
    const propsClear = ({
        onClick: () => setValue() // clear current value
    });
    const propsToggle = ({
        onClick: () => setSearch(search => ({ ...search, active: !search.active })) || refs.current.input.focus() // -> toggle list and focus input
    });
    const propsInput = ({
        ref: ref => refs.current.input = ref,
        placeholder: !search.active && !current && placeholder || null,
        value: search.active && search.value || '',
        onClick: () => setSearch(search => ({ ...search, active: !search.active })), // -> toggle list
        onChange: (event) => setSearch(search => ({ ...search, value: event.target.value, index: 0, active: true })), // -> show list
        onKeyDown: (event) => {
            const { which } = event;
            if (which === 46) return setValue() || event.preventDefault(); // delete -> clear current value
            if (which === 40) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, +1) })) || event.preventDefault(); // down -> select next option
            if (which === 38) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, -1) })) || event.preventDefault(); // up -> select prev option
            if (which === 32) return search.value || setSearch(search => ({ ...search, index: 0, active: !search.active })) || event.preventDefault(); // space (first) -> toggle list
            if (which === 27) return setSearch(search => ({ ...search, active: false })); // esc -> hide list
            if (which === 13) return filtered[search.index] && setValue(filtered[search.index]) || event.preventDefault(); // enter -> change current value
        }
    });
    const propsList = ({
        ref: ref => refs.current.list = ref,
        ...useGesture({
            onScrollEnd: ({ event }) => {
                const { target: { scrollTop, scrollHeight, clientHeight } } = event;
                if (scrollTop < tolerance) return setLimit(step);
                if (scrollTop > scrollHeight - clientHeight - tolerance) return setLimit(count => count + step);
            }
        })()
    });
    const propsItem = (value, index) => ({
        key: stringlify(value),
        active: index === search.index ? 'true' : null,
        onClick: () => setValue(value),
        onMouseEnter: () => setSearch(search => ({ ...search, index }))
    });

    useEffect(() => { // scroll to selected option
        const element = refs.current.list?.children[search.index];
        element && element.scrollIntoView({ block: 'nearest' });
    }, [search.index]);
    useEffect(() => { // focus on start
        focus && refs.current.input.focus();
    }, []);
    return <div {...propsBase}>
        <label>
            <div>{!search.value && current && render(current, true) || null}</div>
            {current && <FiX {...propsClear} />}
            {/* {current && <FiExternalLink />} */}
            {search.active ? <FiChevronsDown {...propsToggle} /> : <FiChevronDown {...propsToggle} />}
        </label>
        <input {...propsInput} />
        {search.active && <div {...propsList}>
            {filtered?.slice(0, limit).map((value, index) => <div {...propsItem(value, index)}>{render(value)}</div>)}
        </div>}
    </div>;
};

export default Select;