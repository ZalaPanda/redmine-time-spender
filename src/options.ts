import React from 'react';
import { createRoot } from 'react-dom/client';
import { Config } from './Config';

const node = React.createElement(Config);
const root = createRoot(document.body.appendChild(document.createElement('div')));
root.render(node);