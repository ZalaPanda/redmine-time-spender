import React, { useState } from 'react';
import { Globals } from 'react-spring';
import { ThemeProvider } from 'react-jss';
import { storage, useAsyncEffect, SettingsProvider } from './storage.js';
import { themes } from './themes.js';
import { Layout } from './Layout.jsx';

const Root = () => {
    const [settings, setSettings] = useState();
    const theme = {
        ...themes[settings?.theme] || themes['dark'],
        spacing: settings?.spacing || 1.6
    };
    useAsyncEffect(async ({ aborted }) => {
        const refresh = async () => {
            const settings = await storage.get();
            const { skipAnimation } = settings;
            Globals.assign({ skipAnimation }); // spring animations
            setSettings(settings);
        };
        if (aborted) return;
        chrome.storage.local.onChanged.addListener(refresh); // refresh on settings change
        refresh();
    }, undefined, []);
    return settings && <SettingsProvider value={settings}>
        <ThemeProvider theme={theme}><Layout /></ThemeProvider>
    </SettingsProvider> || null;
};

export default Root;