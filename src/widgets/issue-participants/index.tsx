import {mountParticipantsWidget} from '../shared/mount';

import {loadIssueParticipants} from './load-issue';

mountParticipantsWidget(loadIssueParticipants, 'column');
