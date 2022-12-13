import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const node = createElement(App);
const root = createRoot(document.body.appendChild(document.createElement('div')));
root.render(node);