import React, { useRef } from 'react';
import { createUseStyles } from 'react-jss';
import { FiLock, FiServer, FiX } from 'react-icons/fi';
import { database, storage, useAsyncEffect, useSettings } from './storage.js';
import { useSpring, animated, config } from 'react-spring';
import { Checkbox } from './atoms/Checkbox.jsx';

const useStyles = createUseStyles(theme => ({
    base: {
        position: 'fixed', zIndex: 1, width: 420, padding: [8, 16], backgroundColor: theme.background, border: [1, 'solid', theme.gray200],
        '&>div': {
            display: 'flex', alignItems: 'center',
            '&>label': { minWidth: 80 },
            '&>input': { flexGrow: 1, flexShrink: 1, minWidth: 20 }
        },
        '&>button': { backgroundColor: theme.gray50 },
        '&>hr': { borderColor: theme.gray50 }
    }
}));

export const Config = ({ onDismiss }) => {
    const classes = useStyles();
    const { url, key, days, hours, spacing = 1.6, skipAnimation = false } = useSettings();
    const refs = useRef({ dismiss: undefined, url: undefined, key: undefined, button: undefined })
    const [{ x }, setSpring] = useSpring(() => ({ x: -600, config: config.stiff, immediate: true }));
    const sum = hours[1] - hours[0];

    const propsDismiss = {
        ref: ref => refs.current.dismiss = ref,
        onClick: async () => {
            await Promise.all(setSpring.start({ x: -600 }));
            onDismiss();
        }
    };
    const propsUrl = {
        defaultValue: url, ref: ref => refs.current.url = ref, placeholder: 'Redmine URL',
        onFocus: event => event.target.select()
    };
    const propsKey = {
        defaultValue: key, ref: ref => refs.current.key = ref, placeholder: 'API key', type: 'password',
        onFocus: event => event.target.select()
    };
    const propsSave = {
        ref: ref => refs.current.button = ref,
        onClick: async () => {
            try {
                debugger;
                refs.current.button.disabled = true;
                const url = refs.current.url.value;
                try {
                    const req = await fetch(url, { method: 'HEAD' });
                    if (!req.ok) throw req.statusText;
                } catch (error) {
                    refs.current.url.select();
                    return;
                }
                const key = refs.current.key.value;
                try {
                    const req = await fetch(`${url}/my/account.json`, { headers: { 'X-Redmine-API-Key': key } });
                    if (!req.ok) throw req.statusText;
                } catch (error) {
                    refs.current.key.select();
                    return;
                }
                await Promise.all([ // purge data
                    database.table('projects').clear(),
                    database.table('issues').clear(),
                    database.table('activities').clear(),
                    database.table('entries').clear(),
                    database.table('tasks').clear()
                ]);
                await storage.set({ url, key });
                // chrome.runtime.sendMessage({ type: 'refresh' }, (results) => {
                //     results.find(res => res) && reload({});
                //     refs.current.refresh.disabled = false;
                // });
            } finally {
                refs.current.button.disabled = false;
            }
        }
    };
    const propsSpacing = (value) => ({
        value, checked: spacing === value,
        onChange: async (spacing) => {
            try {
                await storage.set({ spacing });
            } catch (error) {
                console.log(error);
            }
        }
    });
    const propsSkipAnimation = {
        checked: skipAnimation,
        onChange: async (skipAnimation) => {
            try {
                await storage.set({ skipAnimation });
            } catch (error) {
                console.log(error);
            }
        }
    };

    useAsyncEffect(async ({ aborted }) => { // load projects/issues/activities after load
        await Promise.all(setSpring.start({ x: 0 }));
        if (aborted) return;
        refs.current.dismiss.focus();
    }, undefined, []);
    return <animated.div className={classes.base} style={{ x }}>
        <div>
            <b>Configuration</b>
            <button {...propsDismiss}><FiX /></button>
        </div>
        <hr />
        <div><FiServer /><input {...propsUrl} /></div>
        <div><FiLock /><input {...propsKey} /></div>
        <button {...propsSave}>SAVE</button>
        <hr />
        <div>
            <label>Days:</label>
            <input defaultValue={days} type={'number'} step={1} min={0} max={28} />
            <label>Hours:</label>
            <input defaultValue={hours[0]} type={'number'} step={0.5} min={0} max={24} />
            <input defaultValue={hours[1]} type={'number'} step={0.5} min={0} max={24} />
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
    </animated.div>
};