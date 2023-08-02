/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: clickDocument.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import { createSlice, configureStore } from '@reduxjs/toolkit';
import { ClickPosition } from '../types';
import { CLICK_POSITION_DEFAULT } from '../utils/constants';

interface State {
  clickDocument: ClickPosition;
}

interface Action {
  payload: State;
}

const slice = createSlice({
  name: 'clickDocument',
  initialState: {
    clickDocument: CLICK_POSITION_DEFAULT,
  } as State,
  reducers: {
    changeClickDocument: (state: State, action: Action) => {
      // eslint-disable-next-line no-param-reassign
      state.clickDocument = action.payload.clickDocument;
    },
  },
});

export const { changeClickDocument } = slice.actions;

const storeClickDocument = configureStore({
  reducer: slice.reducer,
});

export default storeClickDocument;
