import { useState, useEffect, useRef, MouseEvent, KeyboardEvent, FocusEvent, ChangeEvent } from 'react';
import { css, Theme, ThemeProvider, Global } from '@emotion/react';
import { FiKey, FiUnlock } from 'react-icons/fi';
import { Globals } from '@react-spring/web';
import { margin, padding } from 'polished';

import { globalStyles, themes } from './themes';
import { createKey, createCryptoApi, convertBinToHex } from './apis/crypto';
import { createRedmineApi } from './apis/redmine';
import { createUnentryptedDatabase } from './apis/database';
import { useAsyncEffect, useRaise } from './apis/uses';

import { storage, cookie, defaultSettings, Settings } from './App';
import { Toaster } from './Toaster';
import { Collapsible } from './atoms/Collapsible';
import { Checkbox } from './atoms/Checkbox';

const configStyles = (theme: Theme) => css([
    globalStyles(theme),
    {
        'body': { minHeight: 380, ...padding(10, 14) },
        'hr': { ...margin(10, 0), border: 0, borderBottom: 1, borderColor: theme.border },
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
        'button': { borderWidth: 1, borderStyle: 'solid', borderColor: theme.border }
    }
]);

const checkboxStyles = css({ cursor: 'pointer' });

export const Config = () => {
    const refs = useRef({
        baseUrlInput: undefined as HTMLInputElement,
        apiKeyInput: undefined as HTMLInputElement,
        setupButton: undefined as HTMLButtonElement,
        resetButton: undefined as HTMLButtonElement
    });
    const raiseError = useRaise('error');

    const [settings, setSettings] = useState<Settings>();
    useAsyncEffect(async ({ aborted }) => { // load settings from local storage
        const settings = await storage.get() as Settings;
        if (aborted) return;
        setSettings({ ...defaultSettings, ...settings });
        if (settings?.redmine) return;
        refs.current.baseUrlInput?.focus(); // focus on base Url input
        setHelp('BaseUrl');
    }, []);

    const [theme, setTheme] = useState<Theme>({ ...themes['dark'], lineHeight: 1.6 });
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

    const [help, setHelp] = useState<string | undefined>();

    const { redmine: { baseUrl } = {}, theme: { isDark, lineHeight } = {}, numberOfDays, workHours: [workHoursStart, workHoursEnd], skipAnimation, autoRefresh, hideInactive } = settings ?? defaultSettings;
    const propsBaseUrlInput = {
        ref: (ref: HTMLInputElement) => refs.current.baseUrlInput = ref,
        name: 'BaseUrl', placeholder: 'Step 1 > Redmine URL', defaultValue: baseUrl, disabled: !!baseUrl,
        onFocus: (event: FocusEvent<HTMLInputElement>) => { event.target.select(); setHelp(event.target.name); },
        onBlur: () => { setHelp(undefined); },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => { event.key === 'Enter' && refs.current.apiKeyInput?.focus(); }
    };
    const propsApiKeyInput = {
        ref: (ref: HTMLInputElement) => refs.current.apiKeyInput = ref,
        name: 'ApiKey', placeholder: 'Step 2 > API key', defaultValue: baseUrl ? '#'.repeat(40) : '', type: 'password', disabled: !!baseUrl,
        onFocus: (event: FocusEvent<HTMLInputElement>) => { event.target.select(); setHelp(event.target.name); },
        onBlur: () => { setHelp(undefined); },
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => { event.key === 'Enter' && refs.current.setupButton?.focus(); }
    };

    const propsSetupButton = {
        ref: (ref: HTMLButtonElement) => refs.current.setupButton = ref,
        onClick: async () => {
            const baseUrl = refs.current.baseUrlInput?.value.replace(/\/+$/, '/');
            if (!baseUrl) {
                refs.current.baseUrlInput?.focus();
                raiseError('Base URL is missing');
                return;
            }
            const apiKey = refs.current.apiKeyInput?.value;
            if (!apiKey) {
                refs.current.apiKeyInput?.focus();
                raiseError('Api key is missing');
                return;
            }
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
                setSettings(settings => settings && { ...settings, redmine: { baseUrl, encodedKey } });
            } catch (error) {
                raiseError(error);
            }
        }
    };
    const propsResetButton = {
        ref: (ref: HTMLButtonElement) => refs.current.resetButton = ref,
        onClick: async () => {
            try {
                // await cookie(baseUrl).permission.remove(); // remove permission to redmine cookies
                const database = createUnentryptedDatabase();
                await database.open();
                database && Promise.all([ // purge everything from database
                    database.table('projects').clear(),
                    database.table('issues').clear(),
                    database.table('activities').clear(),
                    database.table('priorities').clear(),
                    database.table('statuses').clear(),
                    database.table('entries').clear(),
                    database.table('tasks').clear()
                ]);
                await storage.remove('redmine');
                setSettings(settings => {
                    if (!settings) return settings;
                    const { redmine, ...cleared } = settings;
                    return cleared;
                });
            } catch (error) {
                raiseError(error);
            }
        }
    };

    const changeSettings = async (changes: Partial<Settings>) => {
        try {
            await storage.set(changes);
            setSettings(settings => ({ ...settings, ...changes }));
        } catch (error) {
            raiseError(error);
        }
    };

    const propsNumberOfDaysInput = {
        defaultValue: numberOfDays, type: 'number', step: 1, min: 0, max: 28,
        onChange: (event: ChangeEvent<HTMLInputElement>) => changeSettings({ numberOfDays: Number(event.target.value) || numberOfDays })
    };
    const propsWorkHoursStartInput = {
        defaultValue: workHoursStart, type: 'number', step: 1, min: 0, max: workHoursEnd,
        onChange: (event: ChangeEvent<HTMLInputElement>) => changeSettings({ workHours: [Number(event.target.value) || workHoursStart, workHoursEnd] })
    };
    const propsWorkHoursEndInput = {
        defaultValue: workHoursEnd, type: 'number', step: 1, min: workHoursStart, max: 24,
        onChange: (event: ChangeEvent<HTMLInputElement>) => changeSettings({ workHours: [workHoursStart, Number(event.target.value) || workHoursEnd] })
    };
    const propsAutoRefreshRadio = (value: true | 'hour' | 'day') => ({
        value, checked: autoRefresh === value, css: checkboxStyles,
        onChange: (autoRefresh?: 'hour' | 'day') => {
            console.log('CHANGE!', autoRefresh);
            changeSettings({ autoRefresh });
        }
    });
    const propsThemeIsDarkRadio = (value: boolean) => ({
        value, checked: isDark === value, css: checkboxStyles,
        onChange: (isDark: boolean) => changeSettings({ theme: { isDark, lineHeight } })
    })
    const propsLineHeightRadio = (value: number) => ({
        value, checked: lineHeight === value, css: checkboxStyles,
        onChange: (lineHeight: number) => changeSettings({ theme: { isDark, lineHeight } })
    });
    const propsSkipAnimationCheckbox = {
        checked: !!skipAnimation, css: checkboxStyles,
        onChange: (skipAnimation: boolean) => changeSettings({ skipAnimation })
    };
    const propsHideInactiveIssuesCheckbox = {
        checked: hideInactive.issues, css: checkboxStyles,
        onChange: (issues: boolean) => changeSettings({ hideInactive: { ...hideInactive, issues } })
    };
    const propsHideInactiveActivitiesCheckbox = {
        checked: hideInactive.activities, css: checkboxStyles,
        onChange: (activities: boolean) => changeSettings({ hideInactive: { ...hideInactive, activities } })
    };
    const propsHideInactivePrioritiesCheckbox = {
        checked: hideInactive.priorities, css: checkboxStyles,
        onChange: (priorities: boolean) => changeSettings({ hideInactive: { ...hideInactive, priorities } })
    };
    const propsExtensionsShortcutsLink = {
        href: 'chrome://extensions/shortcuts', target: '_blank',
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        }
    };

    return <ThemeProvider theme={theme}>
        <Global styles={configStyles} />
        <Toaster />
        <section>
            <FiUnlock />
            <input {...propsBaseUrlInput} />
        </section>
        <Collapsible open={help === 'BaseUrl'}>
            <small>The <b>base URL</b> of the used Redmine:</small>
            <img src={'img/Redmine-URL.png'} />
        </Collapsible>
        <section>
            <FiKey />
            <input {...propsApiKeyInput} />
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
                <Checkbox {...propsAutoRefreshRadio(true)}>Off</Checkbox>
                <Checkbox {...propsAutoRefreshRadio('hour')}>Hourly</Checkbox>
                <Checkbox {...propsAutoRefreshRadio('day')}>Daily</Checkbox>
            </section>
            <section>
                <label>Hide inactive:</label>
                <Checkbox {...propsHideInactiveIssuesCheckbox}>Issues</Checkbox>
                <Checkbox {...propsHideInactiveActivitiesCheckbox}>Activities</Checkbox>
                <Checkbox {...propsHideInactivePrioritiesCheckbox}>Prios</Checkbox>
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