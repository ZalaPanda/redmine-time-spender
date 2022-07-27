import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Options from './Options.jsx';

const node = createElement(Options);
const root = createRoot(document.body.appendChild(document.createElement('div')));
root.render(node);