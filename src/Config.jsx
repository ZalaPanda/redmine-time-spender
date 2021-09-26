import React, { useState } from 'react';
import { createUseStyles } from 'react-jss';
import { FiCheck, FiTrash2 } from 'react-icons/fi';
import { database, settings, useAsyncEffect, useSettings } from './storage.js';

const useStyles = createUseStyles(theme => ({
    base: { // ???
        position: 'fixed', zIndex: 1, width: 420, height: '100%', alignItems: 'center', backgroundColor: theme.gray100,
        '&>div': { display: 'flex' }
    }
}));

export const Config = ({ onChange, onDismiss }) => {
    const classes = useStyles();
    const { url, key, days, hours } = useSettings();
    const [rows, setRows] = useState();
    const sum = hours[1] - hours[0];
    const checkUrl = async () => {
        try {
            // const { url } = settings;
            const req = await fetch(url, { method: 'HEAD' });
            console.log({ req });
        } catch (error) {
            console.log({ error });
        }
    };
    const checkKey = async () => {
        try {
            // const { key } = settings;
            const req = await fetch(`${url}/my/account.json`, { headers: { 'X-Redmine-API-Key': key } });
            console.log({ req });
        } catch (error) {
            console.log({ error });
        }
    };
    const update = async ({ aborted }) => {
        const [projects, issues, activities, entries, tasks] = await Promise.all([
            database.table('projects').count(),
            database.table('issues').count(),
            database.table('activities').count(),
            database.table('entries').count(),
            database.table('tasks').count()
        ]);
        if (aborted) return;
        setRows({ projects, issues, activities, entries, tasks })
    };
    const purge = async (event) => {
        try {
            event.target.disabled = true;
            const [projects, issues, activities, entries, tasks] = await Promise.all([
                database.table('projects').clear(),
                database.table('issues').clear(),
                database.table('activities').clear(),
                database.table('entries').clear(),
                database.table('tasks').clear()
            ]);
            update();
        }
        finally {
            event.target.disabled = false;
        }
    };
    useAsyncEffect(update, undefined, []);
    return <div className={classes.base}>
        <div>
            <label>URL:</label>
            <input defaultValue={url} />
            <button><FiCheck onClick={checkUrl} /></button>
        </div>
        <div>
            <label>API key:</label>
            <input defaultValue={key} type={'password'} />
            <button><FiCheck onClick={checkKey} /></button>
        </div>
        <div>
            <label>Days:</label>
            <input defaultValue={days} />
        </div>
        <div>
            <label>Hours: (sum: {sum})</label>
            <input defaultValue={hours[0]} />
            <input defaultValue={hours[1]} />
        </div>
        <div>
            {rows && <>
                <label>projects: {rows.projects}</label>
                <label>issues: {rows.issues}</label>
                <label>activities: {rows.activities}</label>
                <label>entries: {rows.entries}</label>
                <label>tasks: {rows.tasks}</label>
            </>}
            <button onClick={purge}><FiTrash2 /></button>
            <button onClick={() => onDismiss}><FiTrash2 /></button>
            
        </div>
    </div>
};