/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: streams.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import { createSlice, configureStore, Draft, CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Stream } from '../types';
import { log } from '../utils/lib';

interface State {
  streams: Stream[];
}

interface Action {
  type: 'add' | 'delete' | 'clean';
  stream: Stream;
  change?: boolean;
}

const ChangeStreams: CaseReducer<State, PayloadAction<Action>> = (state, action) => {
  const oldStreams: Stream[] = state.streams.map((item) => item as Stream);
  let streams: Draft<Stream>[] = [];
  const {
    payload: { stream, type, change = false },
  } = action;
  let index = -1;
  switch (type) {
    case 'add':
      if (
        !oldStreams.find((item, _index) => {
          if (item.target === stream.target) {
            index = _index;
            return true;
          }
          return false;
        })
      ) {
        oldStreams.push(stream);
      } else if (change && index !== -1) {
        oldStreams.splice(index, 1);
        oldStreams.push(stream);
      } else {
        log('info', 'Unnecessary case add', { action, index, change });
      }
      streams = oldStreams as Draft<Stream>[];
      break;
    case 'delete':
      streams = oldStreams.filter((item) => item.target !== stream.target) as Draft<Stream>[];
      break;
    case 'clean':
      streams = [];
      break;
  }
  // eslint-disable-next-line no-param-reassign
  state.streams = streams;
};

const slice = createSlice({
  name: 'streams',
  initialState: {
    streams: [],
  } as State,
  reducers: {
    changeStreams: ChangeStreams,
  },
});

export const { changeStreams } = slice.actions;

const storeStreams = configureStore({
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
  reducer: slice.reducer,
});

export default storeStreams;
