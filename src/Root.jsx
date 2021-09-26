import React, { useState } from 'react';
import { Globals } from 'react-spring';
import { ThemeProvider } from 'react-jss';
import { storage, useAsyncEffect, SettingsProvider } from './storage.js';
import { themes } from './themes.js';
import { Layout } from './Layout.jsx';

const Root = () => {
    const [settings, setSettings] = useState();
    const theme = themes[settings?.theme] || themes['dark'];
    useAsyncEffect(async ({ aborted }) => {
        const settings = await storage.get();
        if (aborted) return;
        setSettings(settings);
        const { skipAnimation } = settings;
        skipAnimation && Globals.assign({ skipAnimation }); // turn off spring animations
    }, undefined, []);
    return settings && <SettingsProvider value={settings}>
        <ThemeProvider theme={theme}><Layout /></ThemeProvider>
    </SettingsProvider> || null;
};

export default Root;