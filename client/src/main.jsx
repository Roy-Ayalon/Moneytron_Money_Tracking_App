import React from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import './styles/main.css';
import App from './components/App';
import FeedbackButton from './components/FeedbackButton';

dayjs.extend(customParseFormat);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.Fragment>
    <App />
    <FeedbackButton />
  </React.Fragment>
);
