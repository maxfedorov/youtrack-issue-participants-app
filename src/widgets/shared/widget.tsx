import {useEffect, useState} from 'react';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';

import {ParticipantsList, type ListLayout} from './participants-list';
import type {Host, Participant, ParticipantsLoader} from './types';

type State =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'ready'; participants: Participant[]};

interface WidgetProps {
  host: Host;
  entityId: string | undefined;
  load: ParticipantsLoader;
  layout: ListLayout;
}

function useParticipants({host, entityId, load}: Omit<WidgetProps, 'layout'>): State {
  const [state, setState] = useState<State>(entityId
    ? {status: 'loading'}
    : {status: 'error', message: 'This widget needs an issue or article to show participants for.'});

  useEffect(() => {
    if (!entityId) {
      return undefined;
    }
    let cancelled = false;
    load(host, entityId).then(
      participants => !cancelled && setState({status: 'ready', participants}),
      (e: unknown) => {
        console.error('Participants: failed to load', e);
        if (!cancelled) {
          setState({status: 'error', message: 'Could not load participants. Try reloading the page.'});
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [host, entityId, load]);

  return state;
}

export function Widget(props: WidgetProps) {
  const state = useParticipants(props);

  return (
    <div className="root">
      {state.status === 'loading' && <LoaderInline/>}
      {state.status === 'error' && <div className="errorState" role="alert">{state.message}</div>}
      {state.status === 'ready' && (
        <ParticipantsList participants={state.participants} layout={props.layout} baseUrl={(YTApp.baseUrl ?? '').replace(/\/+$/, '')}/>
      )}
    </div>
  );
}
