import { css, Theme } from '@emotion/react';
import { fontFace, padding } from 'polished';

declare module '@emotion/react' {
    export interface Theme {
        bg: string,
        text: string,
        border: string,
        danger: string,
        success: string,
        special: string,
        muted: string,
        shadow: string,
        mark: string,
        button: { hover: string, active: string },
        badge: { bg: string, text: string },
        card: { border: string },
        field: { text: string, focus: string },
        title: { bg: string, text: string },
        select: { bg: string, tape: string },
        lineHeight: number
    }
}

/** Color codes for **dark** and **light** theme */
export const themes: { light: Theme, dark: Theme } = {
    light: {
        bg: '#fdfdfd',
        text: '#000000',
        border: '#cccccc',
        danger: '#F7695F',
        success: '#4CAF50',
        special: '#116699',
        muted: '#6F6F6F',
        shadow: '#8f9eadEE',
        mark: '#628DB633',
        button: { hover: '#11669933', active: '#11669966' },
        badge: { bg: '#457097', text: '#eeeff1' },
        card: { border: '#e0e0f0' },
        field: { text: '#DDDDDD', focus: '#628DB6' },
        title: { bg: '#628DB6', text: '#fcfcfc' },
        select: { bg: '#ffffff', tape: '#628DB6' },
        lineHeight: 1.6
    },
    dark: {
        bg: '#202020',
        text: '#eeeff1',
        border: '#4b5158',
        danger: '#9e2a2b',
        success: '#50AF4C',
        special: '#8ab3d8',
        muted: '#CACDD0',
        shadow: '#000000EE',
        mark: '#8ab3d833',
        button: { hover: '#8ab3d833', active: '#8ab3d866' },
        badge: { bg: '#3b5266', text: '#eeeff1' },
        card: { border: '#2E3439' },
        field: { text: '#3b5266', focus: '#8ab3d8' },
        title: { bg: '#2b3641', text: '#CACDD0' },
        select: { bg: '#212528', tape: '#8ab3d8' },
        lineHeight: 1.6
    }
};

export const globalStyles = (theme: Theme) => css([
    fontFace({
        fontFamily: 'WorkSans',
        fontFilePath: 'font/work-sans-v11-latin-500', fileFormats: ['woff2']
    }),
    fontFace({
        fontFamily: 'WorkSans', fontWeight: 'bold',
        fontFilePath: 'font/work-sans-v11-latin-700', fileFormats: ['woff2']
    }),
    {
        '*': { fontSize: 16, fontFamily: 'WorkSans, Verdana, sans-serif', lineHeight: theme.lineHeight },
        'html': { backgroundColor: theme.bg, color: theme.text, scrollBehavior: 'smooth' },
        'input, textarea, button': {
            color: 'unset', backgroundColor: 'transparent',
            border: 'none', margin: 1, ...padding(4, 6), boxSizing: 'border-box', resize: 'none',
            '&:focus': { outline: 'none' },
            '&:disabled': { filter: 'opacity(0.6)', cursor: 'auto' }
        },
        'button': {
            textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer', borderRadius: 4,
            '&:hover, &:focus': { backgroundColor: theme.button.hover },
            '&:active': { backgroundColor: theme.button.active }
        },
        'small': { fontSize: 12 },
        'a': {
            fontWeight: 'bold', color: 'unset', textDecoration: 'none',
            '&:visited': { color: 'unset' },
            '&:hover, &:focus': { textDecoration: 'underline' }
        },
        'b': { fontSize: 'inherit' },
        'svg': { margin: 2, verticalAlign: 'middle', strokeWidth: 2.5 },
        // [scrollbar] https://css-tricks.com/the-current-state-of-styling-scrollbars/
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { borderRadius: 4, backgroundColor: 'transparent' },
        '::-webkit-scrollbar-thumb': { borderRadius: 4, backgroundColor: theme.mark, borderWidth: 2, borderStyle: 'solid', borderColor: theme.bg },
        '::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
        '::-webkit-resizer': { backgroundColor: 'transparent' },
        // [selection]
        '::selection': { backgroundColor: theme.mark },
        // [number input] remove inc/dec buttons
        'input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' },
        // [date input] remove button
        '::-webkit-calendar-picker-indicator': { background: 'none' }
    }
]);
