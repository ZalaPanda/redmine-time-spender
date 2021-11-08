import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { createUseStyles } from 'react-jss';
import { FiChevronDown, FiChevronsDown, FiExternalLink, FiStar, FiX } from 'react-icons/fi';

const useStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    select: {
        display: 'inline-block', position: 'relative',
        '&>input': { width: '100%', margin: 1, padding: 4, boxSizing: 'border-box' },
        '&>label': {
            position: 'absolute', display: 'flex', alignItems: 'center', pointerEvents: 'none',
            width: '100%', height: '100%', margin: 1, padding: 4, boxSizing: 'border-box',
            '&>div': { flexGrow: 1, overflow: 'hidden', whiteSpace: 'nowrap' },
            '&>svg': { flexShrink: 0, pointerEvents: 'auto' },
            '&>a': { display: 'none', pointerEvents: 'auto' }
        },
        '&:hover>label>a': { display: 'unset' },
        '&>div': {
            position: 'absolute', zIndex: 1,
            width: '100%', maxHeight: 200, padding: 0, margin: 0, boxSizing: 'border-box',
            overflowY: 'auto', border: [1, 'solid', theme.border], boxShadow: [0, 3, 9, theme.shadow],
            color: theme.text, backgroundColor: theme.select.bg,
            '&>div': { padding: [4, 6], cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap' },
            '&>div[active]': { borderLeft: [4, 'solid', theme.select.tape], backgroundColor: theme.mark },
            '&>div:hover>svg': { display: 'block' },
            '&>div>svg': {
                float: 'right', color: theme.muted, display: 'none',
                '&[active]': { color: theme.text, display: 'block' },
            },
            '&>small': { padding: [0, 6], color: theme.muted }
        }
    }
}));

const step = 20;
const tolerance = 50;

export const Select = ({
    value: current, values, placeholder,
    stringlify = value => value, render = value => value, linkify = value => null, filter = exp => value => exp.test(value),
    onChange = value => { }, onFavorite = value => { }, onMount = refs => { }, ...props
}) => {
    const classes = useStyles();
    const refs = useRef({ input: undefined, list: undefined, timeout: undefined });
    const [limit, setLimit] = useState(step);
    const [search, setSearch] = useState({ value: '', index: -1, active: false });
    const filtered = useMemo(() => {
        const exp = RegExp((search.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // https://stackoverflow.com/a/6969486
        return values.filter(filter(exp));
    }, [search.value, values]);
    const url = useMemo(() => current && linkify(current), [current]);

    const getIndex = (filtered, index, diff) => filtered[index + diff] ? index + diff : diff < 0 ? 0 : index;
    const setValue = (value) => {
        value !== current && onChange(value);
        setSearch({ value: '', index: -1, active: false });
        refs.current.input.focus();
    };

    const propsSelect = ({
        onBlur: () => refs.current.timeout = setTimeout(() => setSearch({ value: '', index: -1, active: false }), 100), // -> start list hide timeout
        onFocus: () => clearTimeout(refs.current.timeout), // -> cancel list hide timeout
        tabIndex: -1, // needed to detect focus/blur events
        className: classes.select,
        ...props
    });
    const propsLink = ({
        href: url, target: '_blank', tabIndex: -1,
        onClick: event => {
            event.preventDefault();
            chrome.tabs.create({ url, active: false });
        }
    });
    const propsClear = ({
        href: '#', tabIndex: -1,
        onClick: event => {
            event.preventDefault();
            setValue(); // clear current value
        }
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
            if (which === 46) return search.value || setValue() || event.preventDefault(); // delete -> clear current value
            if (which === 40) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, +1) })) || event.preventDefault(); // down -> select next option
            if (which === 38) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, -1) })) || event.preventDefault(); // up -> select prev option
            if (which === 32) return search.value || setSearch(search => ({ ...search, index: search.active ? -1 : 0, active: !search.active })) || event.preventDefault(); // space (first) -> toggle list
            if (which === 27) return setSearch({ value: '', index: -1, active: false }) || event.preventDefault(); // esc -> hide list
            if (which === 13) return filtered[search.index] && setValue(filtered[search.index]) || event.preventDefault(); // enter -> change current value
            if (which === 9) return filtered[search.index] && setValue(filtered[search.index]); // tab -> change current value
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
    const propsFavorite = (value) => ({
        active: value.favorite ? 'true' : null,
        onClick: () => onFavorite(value)
    });

    useEffect(() => { // scroll to selected option
        const element = refs.current.list?.children[search.index];
        element && element.scrollIntoView({ block: 'nearest' });
    }, [search.index]);
    useEffect(() => onMount(refs), []);
    return <div {...propsSelect}>
        <label>
            <div>{!search.value && current && render(current, true) || null}</div>
            {url && <a {...propsLink}><FiExternalLink /></a>}
            {current && <a {...propsClear}><FiX /></a>}
            {search.active ? <FiChevronsDown {...propsToggle} /> : <FiChevronDown {...propsToggle} />}
        </label>
        <input {...propsInput} />
        {search.active && <div {...propsList}>
            {filtered.slice(0, limit).map((value, index) => <div {...propsItem(value, index)}><FiStar {...propsFavorite(value)} />{render(value)}</div>)}
            {!filtered.length && <small>No more options</small>}
        </div>}
    </div>;
};
