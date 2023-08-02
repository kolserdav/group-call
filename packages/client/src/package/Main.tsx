/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: Main.tsx
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { useMemo } from 'react';
import clsx from 'clsx';
import Room from './components/Room';
import Hall from './components/Hall';
import type { GlobalProps } from './types';
import { getPathname, getRoomId, parseQueryString } from './utils/lib';
import ChevronLeftIcon from './Icons/ChevronLeftIcon';
import ChevronRightIcon from './Icons/ChevronRightIcon';
import IconButton from './components/ui/IconButton';
import Alert from './components/ui/Alert';
import s from './Main.module.scss';
import { useListeners } from './Main.hooks';
import { USER_NAME_DEFAULT } from './utils/constants';

function Main({
  port,
  server,
  colors,
  userId: _userId,
  logLevel,
  token = '',
  name = USER_NAME_DEFAULT,
  backLinks = null,
  videoRecord = false,
  iceServers = [],
}: Omit<GlobalProps, 'locale' | 'roomId'>) {
  const pathname = getPathname();
  const qS = useMemo(() => parseQueryString(), []);
  const userId = useMemo(() => qS?.uid || _userId, [_userId, qS?.uid]);
  const roomId = useMemo(() => getRoomId(pathname || ''), [pathname]);
  const { locale, openMenu, theme, alert, hallOpen } = useListeners({
    colors,
    port,
    server,
    logLevel,
  });

  return (
    <div className={s.wrapper}>
      {locale && (
        <Room
          port={port}
          userId={userId}
          server={server}
          colors={colors}
          theme={theme}
          roomId={roomId}
          locale={locale}
          name={name}
          iceServers={iceServers}
        />
      )}
      <div
        className={clsx(s.button, hallOpen ? s.active : '')}
        role="button"
        id="open-chat"
        style={theme?.button}
        tabIndex={0}
        onClick={openMenu}
      >
        <IconButton strict className={clsx(s.button__icon, hallOpen ? s.active : '')}>
          {hallOpen ? (
            <ChevronRightIcon color={theme?.colors.paper} />
          ) : (
            <ChevronLeftIcon color={theme?.colors.paper} />
          )}
        </IconButton>
      </div>
      {locale && (
        <Hall
          roomId={roomId}
          userId={userId}
          open={hallOpen}
          locale={locale}
          server={server}
          port={port}
          theme={theme}
          token={token}
          name={name}
          backLinks={backLinks}
          videoRecord={videoRecord}
        />
      )}
      <Alert open={alert.open} type={alert.type} theme={theme} infinity={alert.infinity}>
        {alert.children}
      </Alert>
    </div>
  );
}

export default Main;
