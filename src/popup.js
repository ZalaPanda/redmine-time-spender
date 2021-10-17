import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.jsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

ReactDOM.render(React.createElement(App), document.getElementById('root'));