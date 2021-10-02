import React, { useState, useMemo, useEffect } from 'react';
import { Globals } from 'react-spring';
import { ThemeProvider } from 'react-jss';
import { storage, SettingsProvider } from './storage.js';
import { themes } from './themes.js';
import { Layout } from './Layout.jsx';

const Root = () => {
    const [settings, setSettings] = useState();

    const theme = useMemo(() => ({
        ...themes[settings?.theme] || themes['dark'],
        spacing: settings?.spacing || 1.6
    }), [settings?.theme, settings?.spacing]);

    useEffect(() => {
        const { skipAnimation } = settings || {};
        Globals.assign({ skipAnimation }); // spring animations on/off
    }, [settings?.skipAnimation]);

    useEffect(() => {
        chrome.storage.local.onChanged.addListener(async () => { // refresh on settings change
            const settings = await storage.get();
            setSettings(settings);
        });
        chrome.storage.local.onChanged.dispatch(); // trigger refresh
    }, []);
    return settings && <SettingsProvider value={settings}>
        <ThemeProvider theme={theme}><Layout /></ThemeProvider>
    </SettingsProvider> || null;
};

export default Root;