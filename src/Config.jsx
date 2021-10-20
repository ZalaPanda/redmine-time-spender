import React, { useRef } from 'react';
import { createUseStyles } from 'react-jss';
import { FiLock, FiServer, FiX } from 'react-icons/fi';
import { useAsyncEffect } from './uses.js';
import { useSpring, animated, config } from '@react-spring/web';
import { Checkbox } from './atoms/Checkbox.jsx';

const useStyles = createUseStyles(theme => ({
    base: {
        position: 'fixed', zIndex: 1, width: 420, margin: 8, padding: 8,
        backgroundColor: theme.bg, border: [1, 'solid', theme.border], boxShadow: [0, 3, 9, theme.shadow]
    },
    title: {
        display: 'flex', alignItems: 'center', padding: [0, 10], backgroundColor: theme.dark, color: theme.textSoft, fontWeight: 'bold'
    },
    fields: {
        '&>div': {
            display: 'flex', alignItems: 'center',
            '&>label': { color: theme.textSoft, minWidth: 80 },
            '&>input': { flexGrow: 1, flexShrink: 1, minWidth: 20 },
            '&[hidden]': { display: 'none' }
        },
        '&>div:focus-within': {
            '&>label': { color: theme.text }, // label with svg icon
        },
        '&>hr': { margin: 4, border: 0, borderBottom: [1, 'solid', theme.border] }
    }
}));

/** @param {{ settings: Settings }} */
export const Config = ({ settings, onChange, onSetup, onReset, onDismiss }) => {
    const classes = useStyles();
    const refs = useRef({ dismissButton: undefined, baseUrlInput: undefined, apiKeyInput: undefined })

    const { redmine: { baseUrl } = {}, theme: { isDark, lineHeight } = {}, numberOfDays, workHours: [workHoursStart, workHoursEnd], skipAnimation } = settings;
    const [{ x }, setSpring] = useSpring(() => ({ x: -600, config: config.stiff, immediate: true }));

    const propsDismiss = {
        ref: ref => refs.current.dismissButton = ref,
        onClick: async () => {
            await Promise.all(setSpring.start({ x: -600 })); // animation before dismiss
            onDismiss();
        }
    };
    const propsBaseUrl = {
        ref: ref => refs.current.baseUrlInput = ref, placeholder: 'Redmine URL', defaultValue: baseUrl, disabled: !!baseUrl,
        onFocus: event => event.target.select()
    };
    const propsApiKey = {
        ref: ref => refs.current.apiKeyInput = ref, placeholder: 'API key', type: 'password', disabled: !!baseUrl,
        onFocus: event => event.target.select()
    };
    const propsSetup = {
        onClick: async _ => {
            const baseUrl = refs.current.baseUrlInput.value.replace(/\/+$/, '/');
            if (!baseUrl) return refs.current.baseUrlInput.focus();
            const apiKey = refs.current.apiKeyInput.value;
            if (!apiKey) return refs.current.apiKeyInput.focus();
            onSetup(baseUrl, apiKey);
        }
    }
    const propsReset = {
        onClick: _ => onReset(baseUrl)
    }
    const propsNumberOfDays = {
        defaultValue: numberOfDays, type: 'number', step: 1, min: 0, max: 28,
        onChange: event => onChange({ numberOfDays: Number(event.target.value) || numberOfDays })
    };
    const propsWorkHoursStart = {
        defaultValue: workHoursStart, type: 'number', step: 1, min: 0, max: workHoursEnd,
        onChange: event => onChange({ workHours: [Number(event.target.value) || workHoursStart, workHoursEnd] })
    };
    const propsWorkHoursEnd = {
        defaultValue: workHoursEnd, type: 'number', step: 1, min: workHoursStart, max: 24,
        onChange: event => onChange({ workHours: [workHoursStart, Number(event.target.value) || workHoursEnd] })
    };
    const propsThemeIsDarkRadio = (value) => ({
        value, checked: isDark === value,
        onChange: isDark => onChange({ theme: { isDark, lineHeight } })
    })
    const propsLineHeightRadio = (value) => ({
        value, checked: lineHeight === value,
        onChange: lineHeight => onChange({ theme: { isDark, lineHeight } })
    });
    const propsSkipAnimation = {
        checked: skipAnimation,
        onChange: skipAnimation => onChange({ skipAnimation })
    };
    const propsExtensionsShortcuts = {
        href: 'chrome://extensions/shortcuts', target: '_blank',
        onClick: event => {
            event.preventDefault();
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        }
    }

    useAsyncEffect(async ({ aborted }) => { // animation after load
        await Promise.all(setSpring.start({ x: 0 }));
        if (aborted) return;
        refs.current.dismissButton.focus();
    }, []);
    return <animated.div className={classes.base} style={{ x }}>
        <div className={classes.title}>
            <b>Configuration</b>
            <button {...propsDismiss}><FiX /></button>
        </div>
        <div className={classes.fields}>
            <div><FiServer /><input {...propsBaseUrl} />{baseUrl && <button {...propsReset}>RESET</button>}</div>
            <div hidden={!!baseUrl}><FiLock /><input {...propsApiKey} /></div>
            {!baseUrl && <button {...propsSetup}>SETUP</button>}
            <hr />
            <div>
                <label>Days:</label>
                <input {...propsNumberOfDays} />
                <label>Hours:</label>
                <input {...propsWorkHoursStart} />
                <input {...propsWorkHoursEnd} />
            </div>
            {/* <div>
                <label>Theme:</label>
                <Checkbox {...propsThemeIsDarkRadio(true)}>Dark</Checkbox>
                <Checkbox {...propsThemeIsDarkRadio(false)}>Light</Checkbox>
            </div> */}
            <div>
                <label>Design:</label>
                <Checkbox {...propsLineHeightRadio(1.6)}>Wide</Checkbox>
                <Checkbox {...propsLineHeightRadio(1.4)}>Normal</Checkbox>
                <Checkbox {...propsLineHeightRadio(1.2)}>Compact</Checkbox>
            </div>
            <div>
                <label>Misc:</label>
                <Checkbox {...propsSkipAnimation}>Skip animations</Checkbox>
            </div>
            <div>
                <label>Hotkey:</label>
                <a {...propsExtensionsShortcuts}>chrome://extensions/shortcuts</a>
            </div>
        </div>
    </animated.div>
};