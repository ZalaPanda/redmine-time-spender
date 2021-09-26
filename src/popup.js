import React from 'react';
import ReactDOM from 'react-dom';
import Root from './Root.jsx';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

ReactDOM.render(React.createElement(Root), document.getElementById('root'));