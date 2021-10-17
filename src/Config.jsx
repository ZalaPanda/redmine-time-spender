import React, { useRef } from 'react';
import { createUseStyles } from 'react-jss';
import { FiLock, FiServer, FiX } from 'react-icons/fi';
import { storage, useAsyncEffect, useRaise, useSettings } from './storage.js';
import { useSpring, animated, config } from 'react-spring';
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
            '&>input': { flexGrow: 1, flexShrink: 1, minWidth: 20 }
        },
        '&>div:focus-within': {
            '&>label': { color: theme.text }, // label with svg icon
        },
        '&>hr': { margin: [0, 10, 0, 30], border: 0, borderBottom: [1, 'solid', theme.border] },
        '&>button': { backgroundColor: theme.special }
    }
}));

export const Config = ({ settings, onRefresh, onDismiss }) => {
    const classes = useStyles();
    const refs = useRef({ dismiss: undefined, url: undefined, key: undefined, button: undefined })
    const raiseError = useRaise('error');

    const { url, key, numberOfDays = 7, workHours = [8, 16], spacing = 1.6, skipAnimation = false } = settings;
    const [{ x }, setSpring] = useSpring(() => ({ x: -600, config: config.stiff, immediate: true }));
    const sum = workHours[1] - workHours[0];

    const propsDismiss = {
        ref: ref => refs.current.dismiss = ref,
        onClick: async () => {
            await Promise.all(setSpring.start({ x: -600 }));
            onDismiss();
        }
    };
    const propsUrl = {
        defaultValue: url, disabled: !!url, ref: ref => refs.current.url = ref, placeholder: 'Redmine URL',
        onFocus: event => event.target.select()
    };
    const propsKey = {
        defaultValue: key, disabled: !!key, ref: ref => refs.current.key = ref, placeholder: 'API key', type: 'password',
        onFocus: event => event.target.select()
    };
    const propsSave = {
        ref: ref => refs.current.button = ref,
        onClick: () => {
            const reset = async () => {
                await Promise.all([ // purge data
                    // database.table('projects').clear(),
                    // database.table('issues').clear(),
                    // database.table('activities').clear(),
                    // database.table('entries').clear(),
                    // database.table('tasks').clear()
                ]);
                await storage.set({ url: undefined, key: undefined });
            };
            const check = async () => {
                const url = refs.current.url.value;
                try {
                    const req = await fetch(url, { method: 'HEAD' });
                    if (!req.ok) throw req.statusText;
                } catch (error) {
                    raiseError(error);
                    refs.current.url.select();
                    return;
                }
                const key = refs.current.key.value;
                try {
                    const req = await fetch(`${url}/my/account.json`, { headers: { 'X-Redmine-API-Key': key } });
                    if (!req.ok) throw req.statusText;
                } catch (error) {
                    raiseError(error);
                    refs.current.key.select();
                    return;
                }
                await storage.set({ url, key });
                onRefresh();
                // chrome.runtime.sendMessage({ type: 'refresh' }, (results) => {
                //     results.find(res => res) && reload({});
                //     refs.current.refresh.disabled = false;
                // });
            };
            url && key && reset() || check();
        }
    };
    const propsSpacing = (value) => ({
        value, checked: spacing === value,
        onChange: async (spacing) => {
            try {
                await storage.set({ spacing });
            } catch (error) {
                raiseError(error);
            }
        }
    });
    const propsSkipAnimation = {
        checked: skipAnimation,
        onChange: async (skipAnimation) => {
            try {
                await storage.set({ skipAnimation });
            } catch (error) {
                raiseError(error);
            }
        }
    };

    useAsyncEffect(async ({ aborted }) => { // load projects/issues/activities after load
        await Promise.all(setSpring.start({ x: 0 }));
        if (aborted) return;
        refs.current.dismiss.focus();
    }, []);
    return <animated.div className={classes.base} style={{ x }}>
        <div className={classes.title}>
            <b>Configuration</b>
            <button {...propsDismiss}><FiX /></button>
        </div>
        <div className={classes.fields}>
            <div><FiServer /><input {...propsUrl} /></div>
            <div><FiLock /><input {...propsKey} /></div>
            <button {...propsSave}>{(url && key) ? 'Reset' : 'Save'}</button>
            <hr />
            <div>
                <label>Days:</label>
                <input defaultValue={numberOfDays} type={'number'} step={1} min={0} max={28} />
                <label>Hours:</label>
                <input defaultValue={workHours[0]} type={'number'} step={0.5} min={0} max={24} />
                <input defaultValue={workHours[1]} type={'number'} step={0.5} min={0} max={24} />
            </div>
            <div>
                <label>Design:</label>
                <Checkbox {...propsSpacing(1.6)}>Wide</Checkbox>
                <Checkbox {...propsSpacing(1.4)}>Normal</Checkbox>
                <Checkbox {...propsSpacing(1.2)}>Compact</Checkbox>
            </div>
            <div>
                <label>Misc:</label>
                <Checkbox {...propsSkipAnimation}>Skip animations</Checkbox>
            </div>
        </div>
    </animated.div>
};