import {mountParticipantsWidget} from '../shared/mount';

import {loadArticleParticipants} from './load-article';

mountParticipantsWidget(loadArticleParticipants, 'grid');
