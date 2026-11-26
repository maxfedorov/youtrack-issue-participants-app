import React from 'react';
import ReactDOM from 'react-dom/client';
import '@jetbrains/ring-ui-built/components/style.css';
import {ControlsHeight, ControlsHeightContext} from '@jetbrains/ring-ui-built/components/global/controls-height';

import type {ListLayout} from './participants-list';
import type {ParticipantsLoader} from './types';
import {Widget} from './widget';

import './participants.css';

/** Registers the widget with YouTrack and renders the shared participants UI. */
export async function mountParticipantsWidget(load: ParticipantsLoader, layout: ListLayout): Promise<void> {
  const host = await YTApp.register();
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ControlsHeightContext.Provider value={ControlsHeight.S}>
        <Widget host={host} entityId={YTApp.entity?.id} load={load} layout={layout}/>
      </ControlsHeightContext.Provider>
    </React.StrictMode>
  );
}
