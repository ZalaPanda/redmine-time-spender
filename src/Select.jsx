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
            '&[reverse]': { bottom: 32, flexDirection: 'column-reverse' },
            '&>div': { flexShrink: 0, padding: [4, 6], cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            '&>div[active]': { borderLeft: '4px solid #80bdff', backgroundColor: '#eee' }
        }
    },
    list: {
        position: 'relative',

    }
});

const Select = ({ value: current, values, disabled, placeholder, className, focus, stringlify = value => value, render = value => value, filter = exp => value => exp.test(value), onChange = value => { }, ...props }) => {
    const classes = useStyles();
    const refs = useRef({ button: undefined, input: undefined, list: undefined, reverse: false, timeout: undefined });

    const step = 20;
    const tolerance = 50;
    const [limit, setLimit] = useState(step);
    const bindScroll = useGesture({
        onScrollEnd: ({ event: { target } }) => {
            if (target.scrollTop < tolerance) return setLimit(step);
            if (target.scrollTop > target.scrollHeight - target.clientHeight - tolerance) return setLimit(count => count + step);
        }
    });

    const [search, setSearch] = useState({ filter: '', index: -1, active: false });
    const bindBase = () => ({
        onBlur: () => refs.current.timeout = setTimeout(() => setSearch(search => ({ ...search, active: false })), 100), // -> start hide options timeout
        onFocus: () => clearTimeout(refs.current.timeout), // -> cancel hide options timeout
        tabIndex: -1 // needed to detect focus/blur events
    });
    const bindSearch = () => ({
        onClick: () => setSearch(search => ({ ...search, active: !search.active })), // -> toggle options
        onChange: (event) => setSearch(search => ({ ...search, filter: event.target.value, index: 0, active: true })), // -> show options
        onKeyDown: (event) => {
            const getIndex = (filtered, index, diff) => filtered[index + diff] ? index + diff : diff < 0 ? 0 : index;
            const { which } = event;
            const { button, reverse } = refs.current;
            if (which === 46) return onValueChange() || event.preventDefault(); // delete -> remove selected value
            if (which === 40) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, reverse ? -1 : 1) })) || event.preventDefault(); // down -> select next option
            if (which === 38) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, reverse ? 1 : -1) })) || event.preventDefault(); // up -> select prev option
            if (which === 32) return search.filter || setSearch(search => ({ ...search, index: 0, active: !search.active })) || event.preventDefault(); // space (first) -> toggle options
            if (which === 27) return setSearch(search => ({ ...search, active: false })); // esc -> hide options
            if (which === 13) return filtered[search.index] && onValueChange(filtered[search.index]) || event.preventDefault(); // enter -> change selected value
            // if (which === 9) return filtered[search.index] && onValueChange(filtered[search.index]); // tab
            // console.log(event);
        }
    });
    // const onSearchChange = (event) => setSearch(search => ({ ...search, filter: event.target.value, index: 0, active: true }));
    // const onSearchActive = (active) => (e) => {
    //     if (active) clearTimeout(refs.current.timeout);
    //     else refs.current.timeout = setTimeout(() => setSearch(search => ({ ...search, active })), 100);
    //     // refs.current.focus = active;
    //     // active && refs.current.input.focus();
    //     // const { height } = document.body.getBoundingClientRect();
    //     // const { bottom } = refs.current.input.getBoundingClientRect();
    //     // refs.current.reverse = height - 120 < bottom;
    // };
    // const onSearchNavigate = (event) => {
    //     const getIndex = (filtered, index, diff) => filtered[index + diff] ? index + diff : diff < 0 ? 0 : index;
    //     const { which } = event;
    //     const { button, reverse } = refs.current;
    //     if (which === 38) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, reverse ? 1 : -1) })) || event.preventDefault(); // up
    //     if (which === 40) return setSearch(search => ({ ...search, active: true, index: getIndex(filtered, search.index, reverse ? -1 : 1) })) || event.preventDefault(); // down
    //     if (which === 13) return onValueChange(filtered[search.index]) || event.preventDefault(); // enter
    //     if (which === 32) return search.filter || setSearch(search => ({ ...search, active: !search.active })) || event.preventDefault(); // space
    //     if (which === 27) return setSearch(search => ({ ...search, active: false })); // esc
    // }
    const onValueHover = (index) => () => setSearch(search => ({ ...search, index })); // hover
    const onValueClick = (value) => () => onValueChange(value);
    const onValueChange = (value) => {
        console.log('onValueChange', value, current);
        value !== current && onChange(value);
        setSearch({ filter: '', index: -1, active: false });
        refs.current.input.focus();
    };
    const filtered = useMemo(() => {
        const exp = RegExp((search.filter).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // https://stackoverflow.com/a/6969486
        return values?.filter(filter(exp)) || [];
    }, [search.filter, values]);
    // useEffect(() => {
    //     console.log('useEffect', current);
    //     clearTimeout(refs.current.timeout);
    //     if (current) setSearch(search => ({ ...search, active: false }));
    // }, [current]);
    useEffect(() => {
        const element = refs.current?.list?.children[search.index];
        if (!element) return;
        element.scrollIntoView({ block: 'nearest' });
    }, [search.index]);
    useEffect(() => {
        focus && refs.current.input.focus();
    }, []);
    // useEffect(() => {
    //     if (!search.active) return;
    //     setSearch(search => ({ ...search, filter: '', index: -1 }));
    //     refs.current.input.focus()
    // }, [search.active]);
    return <div className={classes.base} {...props} {...bindBase()}>
        <label>
            <div>{!search.filter && current && render(current, true) || null}</div>
            {current && <FiX onClick={() => onValueChange()} />}
            {/* {current && <FiExternalLink />} */}
            {search.active ? <FiChevronsDown /> : <FiChevronDown />}
        </label>
        <input
            ref={ref => refs.current.input = ref}
            placeholder={!search.active && !current && placeholder || null}
            {...bindSearch()}
            // onChange={onSearchChange}
            // onKeyDown={onSearchNavigate}
            // disabled={disabled || !values[0]}
            className={className}
            value={search.active && search.filter || ''} />
        {search.active && <div ref={ref => refs.current.list = ref} {...bindScroll()}>
            {filtered?.slice(0, limit).map((value, index) =>
                <div key={stringlify(value)} active={index === search.index ? 'true' : null} onClick={onValueClick(value)} onMouseEnter={onValueHover(index)}>
                    {render(value)}
                </div>)}
        </div>}
    </div>;
};

export default Select;