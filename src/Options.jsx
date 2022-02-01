import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, createUseStyles } from 'react-jss';
import { FiKey, FiUnlock } from 'react-icons/fi';
import { Globals } from '@react-spring/web';

import { themes } from './themes.js';
import { createKey, createCryptoApi, convertBinToHex } from './apis/crypto.js';
import { createRedmineApi } from './apis/redmine.js';
import { createUnentryptedDatabase } from './apis/database.js';
import { useAsyncEffect, useRaise } from './apis/uses.js';

import { useGlobalStyles, storage, cookie, defaultSettings } from './App.jsx';
import { Toaster } from './Toaster.jsx';
import { Collapsible } from './atoms/Collapsible.jsx';
import { Checkbox } from './atoms/Checkbox.jsx';

const useStyles = createUseStyles(/** @param {Theme} theme */ theme => ({
    '@global': {
        'body': { minHeight: 380, padding: [10, 14] },
        'hr': { margin: [10, 0], border: 0, borderBottom: [1, 'solid', theme.border] },
        'section': {
            display: 'flex', alignItems: 'center',
            '&>svg': { color: theme.field.text },
            '&>label': { color: theme.muted, minWidth: 160 },
            '&>input': { flexGrow: 1, flexShrink: 1, minWidth: 20 },
            '&>input[type=number]': { flexGrow: 0, width: 40, textAlign: 'center' },
            '&>div[tabindex]': { paddingRight: 10 },
            '&[hidden]': { display: 'none' },
            '&>a': { color: theme.special }
        },
        'section:focus-within': {
            '&>svg': { color: theme.field.focus }, // label with svg icon
        },
        'button': { border: [1, 'solid', theme.border] }
    },
    checkbox: { cursor: 'pointer' }
}));

const Options = () => {
    const refs = useRef({ baseUrlInput: undefined, apiKeyInput: undefined, setupButton: undefined, resetButton: undefined })
    const raiseError = useRaise('error');

    /** @type {[Settings, React.Dispatch<(prevState: Settings) => Settings>]} */
    const [settings, setSettings] = useState();
    useAsyncEffect(async ({ aborted }) => { // load settings from local storage
        const settings = await storage.get();
        if (aborted) return;
        setSettings({ ...defaultSettings, ...settings });
        if (!settings?.redmine) refs.current.baseUrlInput?.focus(); // focus on base Url input
    }, []);

    /** @type {[Theme, React.Dispatch<(prevState: Theme) => Theme>]} */
    const [theme, setTheme] = useState({ ...themes['dark'], lineHeight: 1.6 });
    useGlobalStyles({ theme });
    const classes = useStyles({ theme });

    useEffect(() => { // update theme
        if (!settings?.theme) return;
        const { theme: { isDark, lineHeight } } = settings;
        setTheme({ ...themes[isDark ? 'dark' : 'light'], lineHeight })
    }, [settings?.theme]);

    useEffect(() => { // spring animations on/off
        if (!settings) return;
        const { skipAnimation } = settings;
        Globals.assign({ skipAnimation });
    }, [settings?.skipAnimation]);

    /** @type {[string, React.Dispatch<(prevState: string) => string>]} */
    const [help, setHelp] = useState();

    const { redmine: { baseUrl } = {}, theme: { isDark, lineHeight } = {}, numberOfDays, workHours: [workHoursStart, workHoursEnd], skipAnimation, autoRefresh, hideInactive } = settings ?? defaultSettings;
    const propsBaseUrlInput = {
        ref: ref => refs.current.baseUrlInput = ref, name: 'BaseUrl', placeholder: 'Step 1 > Redmine URL', defaultValue: baseUrl, disabled: !!baseUrl,
        onFocus: event => event.target.select() || setHelp(event.target.name), onBlur: _ => setHelp(),
        onKeyDown: event => event.which === 13 && refs.current.apiKeyInput.focus()
    };
    const propsApiKeyInput = {
        ref: ref => refs.current.apiKeyInput = ref, name: 'ApiKey', placeholder: 'Step 2 > API key', defaultValue: baseUrl ? '#'.repeat(40) : '', type: 'password', disabled: !!baseUrl,
        onFocus: event => event.target.select() || setHelp(event.target.name), onBlur: _ => setHelp(),
        onKeyDown: event => event.which === 13 && refs.current.setupButton.focus()
    };

    const propsSetupButton = {
        ref: ref => refs.current.setupButton = ref,
        onClick: async _ => {
            const baseUrl = refs.current.baseUrlInput.value.replace(/\/+$/, '/');
            if (!baseUrl) return refs.current.baseUrlInput.focus() || raiseError('Base URL is missing');
            const apiKey = refs.current.apiKeyInput.value;
            if (!apiKey) return refs.current.apiKeyInput.focus() || raiseError('Api key is missing');
            try {
                const result = await cookie(baseUrl).permission.contains(); // check permission to redmine cookies
                if (!result) await cookie(baseUrl).permission.request(); // request permission
                const redmine = createRedmineApi(baseUrl, apiKey);
                await redmine.getUser(); // check URL and API key
                const cryptoKey = createKey(); // generate new crypto key
                await cookie(baseUrl).set(convertBinToHex(cryptoKey)); // save crypto key in cookie
                const crypto = createCryptoApi(cryptoKey);
                const encodedKey = convertBinToHex(crypto.encrypt(apiKey)); // encrypt API key
                await storage.set({ redmine: { baseUrl, encodedKey } }); // save URL and encoded API key
                setSettings(settings => ({ ...settings, redmine: { baseUrl, encodedKey } }));
            } catch (error) {
                raiseError(error);
            }
        }
    };
    const propsResetButton = {
        ref: ref => refs.current.resetButton = ref,
        onClick: async _ => {
            try {
                // await cookie(baseUrl).permission.remove(); // remove permission to redmine cookies
                const database = createUnentryptedDatabase();
                await database.open();
                database && Promise.all([ // purge everything from database
                    database.table('projects').clear(),
                    database.table('issues').clear(),
                    database.table('activities').clear(),
                    database.table('entries').clear(),
                    database.table('tasks').clear() // TODO: transfer tasks?
                ]);
                await storage.remove('redmine');
                setSettings(({ redmine, ...settings }) => settings);
            } catch (error) {
                raiseError(error);
            }
        }
    };

    const changeSettings = async changes => {
        try {
            await storage.set(changes);
            setSettings(settings => ({ ...settings, ...changes }));
        } catch (error) {
            raiseError(error);
        }
    };

    const propsNumberOfDaysInput = {
        defaultValue: numberOfDays, type: 'number', step: 1, min: 0, max: 28,
        onChange: event => changeSettings({ numberOfDays: Number(event.target.value) || numberOfDays })
    };
    const propsWorkHoursStartInput = {
        defaultValue: workHoursStart, type: 'number', step: 1, min: 0, max: workHoursEnd,
        onChange: event => changeSettings({ workHours: [Number(event.target.value) || workHoursStart, workHoursEnd] })
    };
    const propsWorkHoursEndInput = {
        defaultValue: workHoursEnd, type: 'number', step: 1, min: workHoursStart, max: 24,
        onChange: event => changeSettings({ workHours: [workHoursStart, Number(event.target.value) || workHoursEnd] })
    };
    const propsAutoRefreshRadio = value => ({
        value, checked: autoRefresh === value, className: classes.checkbox,
        onChange: autoRefresh => changeSettings({ autoRefresh })
    });
    const propsThemeIsDarkRadio = value => ({
        value, checked: isDark === value, className: classes.checkbox,
        onChange: isDark => changeSettings({ theme: { isDark, lineHeight } })
    })
    const propsLineHeightRadio = value => ({
        value, checked: lineHeight === value, className: classes.checkbox,
        onChange: lineHeight => changeSettings({ theme: { isDark, lineHeight } })
    });
    const propsSkipAnimationCheckbox = {
        checked: skipAnimation, className: classes.checkbox,
        onChange: skipAnimation => changeSettings({ skipAnimation })
    };
    const propsHideInactiveIssuesCheckbox = {
        checked: hideInactive.issues, className: classes.checkbox,
        onChange: issues => changeSettings({ hideInactive: { ...hideInactive, issues } })
    };
    const propsHideInactiveActivitiesCheckbox = {
        checked: hideInactive.activities, className: classes.checkbox,
        onChange: activities => changeSettings({ hideInactive: { ...hideInactive, activities } })
    };
    const propsExtensionsShortcutsLink = {
        href: 'chrome://extensions/shortcuts', target: '_blank',
        onClick: event => {
            event.preventDefault();
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        }
    };

    return <ThemeProvider theme={theme}>
        <Toaster />
        <section>
            <FiUnlock />
            <input {...propsBaseUrlInput} />
            {/* <FiHelpCircle {...propsHelpToggle('BaseUrl')} /> */}
        </section>
        <Collapsible open={help === 'BaseUrl'}>
            <small>The <b>base URL</b> of the used Redmine:</small>
            <img src={'img/Redmine-URL.png'} />
        </Collapsible>
        <section>
            <FiKey />
            <input {...propsApiKeyInput} />
            {/* <FiHelpCircle {...propsHelpToggle('ApiKey')} /> */}
        </section>
        <Collapsible open={help === 'ApiKey'}>
            <small>The <b>API access key</b> under <b>My account</b> in Redmine:</small>
            <img src={'img/API-key.png'} />
        </Collapsible>
        {!baseUrl && <button {...propsSetupButton}>SETUP</button>}
        {baseUrl && <>
            <label>Redmine successfully linked with extension.</label><br />
            <button {...propsResetButton}>RESET</button>
            <hr />
            <section>
                <label>Number of days:</label>
                <input {...propsNumberOfDaysInput} />
            </section>
            <section>
                <label>Work hours:</label>
                <input {...propsWorkHoursStartInput} />-<input {...propsWorkHoursEndInput} />
            </section>
            <section>
                <label>Auto refresh:</label>
                <Checkbox {...propsAutoRefreshRadio(false)}>Off</Checkbox>
                <Checkbox {...propsAutoRefreshRadio('hour')}>Hourly</Checkbox>
                <Checkbox {...propsAutoRefreshRadio('day')}>Daily</Checkbox>
            </section>
            <section>
                <label>Hide inactive:</label>
                <Checkbox {...propsHideInactiveIssuesCheckbox}>Issues</Checkbox>
                <Checkbox {...propsHideInactiveActivitiesCheckbox}>Activities</Checkbox>
            </section>
            <section>
                <label>Hotkey:</label>
                <a {...propsExtensionsShortcutsLink}>extensions/shortcuts</a>
            </section>
        </>}
        <hr />
        <section>
            <label>Theme:</label>
            <Checkbox {...propsThemeIsDarkRadio(true)}>Dark</Checkbox>
            <Checkbox {...propsThemeIsDarkRadio(false)}>Light</Checkbox>
        </section>
        <section>
            <label>Design:</label>
            <Checkbox {...propsLineHeightRadio(1.6)}>Wide</Checkbox>
            <Checkbox {...propsLineHeightRadio(1.2)}>Compact</Checkbox>
        </section>
        <section>
            <label>Misc:</label>
            <Checkbox {...propsSkipAnimationCheckbox}>Skip animations</Checkbox>
        </section>
    </ThemeProvider >;
};

export default Options;