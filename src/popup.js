import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.jsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const key = (Math.random() + 1).toString(36).substring(7);
ReactDOM.render(React.createElement(App), document.getElementById('root'));