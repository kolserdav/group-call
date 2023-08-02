/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: Hall.hooks.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import React, { useEffect, useState } from 'react';
import { LocalStorageName, setLocalStorage } from '../utils/localStorage';
import { getDocumentWidth } from '../utils/lib';
import { MOBILE_WIDTH } from '../utils/constants';

export const useSettings = ({ open }: { open: boolean }) => {
  const [openSettings, setOpenSettings] = useState<boolean>(
    localStorage.getItem(LocalStorageName.SETTINGS_OPEN) === 'true' &&
      getDocumentWidth() <= MOBILE_WIDTH
  );
  const openSettingsDialog = () => {
    setLocalStorage(LocalStorageName.SETTINGS_OPEN, !openSettings);
    setOpenSettings(!openSettings);
  };

  /**
   * Listen close
   */
  useEffect(() => {
    if (openSettings && !open) {
      setOpenSettings(false);
      setLocalStorage(LocalStorageName.SETTINGS_OPEN, false);
    }
  }, [open, openSettings]);

  return { openSettings, openSettingsDialog };
};

export const useUserList = ({ open }: { open: boolean }) => {
  const [openUserList, setOpenUserList] = useState<boolean>(
    localStorage.getItem(LocalStorageName.USERS_OPEN) === 'true' &&
      getDocumentWidth() <= MOBILE_WIDTH
  );
  const openUserListHandler = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setLocalStorage(LocalStorageName.USERS_OPEN, !openUserList);
    setOpenUserList(!openUserList);
  };

  return { openUserList, openUserListHandler };
};
