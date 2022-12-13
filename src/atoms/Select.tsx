import { useState, useEffect, useMemo, useRef, ChangeEvent, KeyboardEvent, MouseEvent, FC, ReactElement, MutableRefObject } from 'react';
import { css, Theme } from '@emotion/react';
import { padding } from 'polished';
import { useGesture } from '@use-gesture/react';
import { FiChevronDown, FiChevronsDown, FiExternalLink, FiStar, FiX } from 'react-icons/fi';

const selectStyles = (theme: Theme) => css({
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
        overflowY: 'auto', borderWidth: 1, borderStyle: 'solid', borderColor: theme.border, boxShadow: `0 3px 9px ${theme.shadow}`,
        color: theme.text, backgroundColor: theme.select.bg,
        '&>div': { ...padding(4, 6), cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap' },
        '&>div[active]': { border: 0, borderLeft: 4, borderStyle: 'solid', borderColor: theme.select.tape, backgroundColor: theme.mark },
        '&>div:hover>svg': { display: 'block' },
        '&>div>svg': {
            float: 'right', color: theme.muted, display: 'none',
            '&[active]': { color: theme.text, display: 'block' },
        },
        '&>small': { ...padding(0, 6), color: theme.muted }
    }
});

const step = 20;
const tolerance = 50;

interface SelectProps<T> {
    value: T | undefined,
    values: T[],
    placeholder?: string,
    render?: (value: T, short?: boolean) => any,
    stringlify?: (value: T) => string,
    linkify?: (value: T) => string | undefined,
    filter?: (exp: RegExp) => (value: T) => boolean,
    onChange?: (value?: T) => void,
    onFavorite?: (value: T) => void,
    onMount?: (refs: MutableRefObject<{ input: HTMLInputElement, list: HTMLDivElement }>) => void
};

export const Select = <T extends {}>({
    value: current, values, placeholder,
    render = value => <>{value}</>,
    stringlify = value => String(value),
    linkify = _value => null,
    filter = exp => value => exp.test(String(value)),
    onChange = _value => { },
    onFavorite = _value => { },
    onMount = _refs => { }, ...props
}: SelectProps<T>) => {
    const refs = useRef({
        input: undefined as HTMLInputElement,
        list: undefined as HTMLDivElement,
        timeout: undefined as NodeJS.Timeout
    });
    const [limit, setLimit] = useState(step);
    const [search, setSearch] = useState<{ value: string, index: number, active: boolean }>({ value: '', index: -1, active: false });
    const filtered = useMemo(() => {
        const exp = RegExp((search.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // https://stackoverflow.com/a/6969486
        return values.filter(filter(exp));
    }, [search.value, values]);
    const url = useMemo(() => current && linkify(current), [current]);

    const getIndex = (filtered: any[], index: number, diff: number) => filtered[index + diff] ? index + diff : diff < 0 ? 0 : index;
    const setValue = (value?: T) => {
        value !== current && onChange(value);
        setSearch({ value: '', index: -1, active: false });
        refs.current.input.focus();
    };

    const propsSelect = ({ // NOTE: focus/blur timeout is needed because the toggle list button steals the focus
        onBlur: () => refs.current.timeout = setTimeout(() => setSearch({ value: '', index: -1, active: false }), 100), // -> start list hide timeout
        onFocus: () => clearTimeout(refs.current.timeout), // -> cancel list hide timeout
        tabIndex: -1, // needed to detect focus/blur events
        css: selectStyles,
        ...props
    });
    const propsLink = ({
        href: url, target: '_blank', tabIndex: -1,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            chrome.tabs.create({ url, active: false });
        }
    });
    const propsClear = ({
        href: '#', tabIndex: -1,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            setValue(); // clear current value
        }
    });
    const propsToggle = ({
        onClick: () => {
            setSearch(search => ({ ...search, active: !search.active }));
            refs.current.input.focus() // -> toggle list and focus input
        }
    });
    const propsInput = ({
        ref: (ref: HTMLInputElement) => refs.current.input = ref,
        placeholder: !search.active && !current && placeholder || null,
        value: search.active && search.value || '',
        onClick: () => setSearch(search => ({ ...search, active: !search.active })), // -> toggle list
        onChange: (event: ChangeEvent<HTMLInputElement>) => setSearch(search => ({ ...search, value: event.target.value, index: 0, active: true })), // -> show list
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            const { key } = event;
            if (key === 'Delete') { // clear value
                if (search.value) return;
                setValue();
                return event.preventDefault();
            }
            if (key === 'ArrowDown') { // select next option
                setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, +1) }));
                return event.preventDefault();
            }
            if (key === 'ArrowUp') { // select prev option
                setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, -1) }));
                return event.preventDefault();
            }
            if (key === ' ' || key === 'Spacebar') { // toggle list
                if (search.value) return;
                setSearch(search => ({ ...search, index: search.active ? -1 : 0, active: !search.active }));
                return event.preventDefault();
            }
            if (key === 'Escape' || key === 'Esc') { // hide list
                setSearch({ value: '', index: -1, active: false });
                return event.preventDefault();
            }
            if (key === 'Enter' || key === 'Tab') { // change current value
                filtered[search.index] && setValue(filtered[search.index]);
                return key === 'Enter' && event.preventDefault();
            }
        }
    });
    const propsList = ({
        ref: (ref: HTMLDivElement) => refs.current.list = ref,
        ...useGesture({
            onScrollEnd: ({ event }) => {
                const { target } = event;
                const { scrollTop, scrollHeight, clientHeight } = target as HTMLDivElement;
                if (scrollTop < tolerance) return setLimit(step);
                if (scrollTop > scrollHeight - clientHeight - tolerance) return setLimit(count => count + step);
            }
        }, {})()
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
    useEffect(() => {
        onMount(refs);
    }, []);
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
