/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: Settings.tsx
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import React from 'react';
import clsx from 'clsx';
import IconButton from './ui/IconButton';
import RecIcon from '../Icons/Rec';
import StopIcon from '../Icons/Stop';
import { changeThemeHandler } from './Hall.lib';
import ThemeIcon from '../Icons/ThemeIcon';
import { LocaleSelector } from '../types/interfaces';
import Select from './ui/Select';
import s from './Settings.module.scss';
import { SettingsProps } from '../types';
import {
  useSettingsStyle,
  usePlayVideo,
  useDeleteVideo,
  useVideoRecord,
  useLang,
  useMessages,
  useUpdateVideo,
  useTmpVideos,
} from './Settings.hooks';
import PlayIcon from '../Icons/Play';
import Video from './Video';
import DeleteIcon from '../Icons/Delete';
import { useIsOwner } from '../utils/hooks';
import Dialog from './ui/Dialog';
import Button from './ui/Button';
import EditIcon from '../Icons/Edit';
import Input from './ui/Input';
import { INPUT_CHANGE_NAME_ID, VIDEO_NAME_MAX_LENGHT } from '../utils/constants';
import Canvas from './Canvas';

function Settings({
  theme,
  open,
  locale,
  roomId,
  userId,
  server,
  port,
  token,
  name,
  videoRecord,
}: SettingsProps) {
  const { lang, changeLang } = useLang();
  const { settingsRef, settingStyle } = useSettingsStyle();

  const { playVideoWrapper, playedVideo, handleCloseVideo } = usePlayVideo({
    server,
    port,
    roomId,
    token,
  });
  const { videos, time, started, buttonDisabled, setButtonDisabled, ws, loadProcent } = useMessages(
    {
      roomId,
      server,
      port,
      userId,
      protocol: 'settings',
      token,
    }
  );
  const { deleteVideoWrapper, dialogDelete, closeDeleteDialogHandler, openDeleteDialogWrapper } =
    useDeleteVideo({ roomId, ws, token, userId });
  const {
    updateVideoWrapper,
    dialogUpdate,
    closeUpdateDialogHandler,
    videoName,
    nameLenght,
    openUpdateDialogWrapper,
    onInputName,
  } = useUpdateVideo({ roomId, ws, token, userId });
  const { recordStartWrapper } = useVideoRecord({
    roomId,
    userId,
    buttonDisabled,
    setButtonDisabled,
    token,
    ws,
  });

  const { isOwner } = useIsOwner({ userId });

  const { tmps, playTmpWrapper, playedTmp, handleCloseTmp } = useTmpVideos();

  return (
    <div
      style={{ background: theme?.colors.paper }}
      className={clsx(s.wrapper, open ? s.open : '')}
    >
      <div className={s.item} style={{ boxShadow: `1px 3px 1px ${theme?.colors.active}` }}>
        <h5 className={s.item__title}>{locale.generalSettings}</h5>

        <div className={s.item__row}>
          <h6 className={s.item__title}>{locale.changeLang}</h6>
          <Select theme={theme} onChange={changeLang} value={lang} title={locale.changeLang}>
            {LocaleSelector}
          </Select>
        </div>

        <div className={s.item__row}>
          <h6 className={s.item__title}>{locale.darkTheme}</h6>
          <div className={s.item__actions}>
            <IconButton onClick={changeThemeHandler} title={locale.changeTheme}>
              <ThemeIcon color={theme?.colors.text} />
            </IconButton>
          </div>
        </div>
      </div>
      {videoRecord && isOwner && (
        <div
          className={s.item}
          ref={settingsRef}
          style={settingStyle ? { boxShadow: `1px 3px 1px ${theme?.colors.active}` } : {}}
        >
          <h5 className={s.item__title}>{locale.recordActions}</h5>
          <div className={s.item__row}>
            <h6 className={s.item__title}>{locale.recordVideo}</h6>
            <div className={s.item__actions}>
              <IconButton
                title={started ? locale.stopRecord : locale.startRecord}
                className={started ? s.text__button : ''}
                onClick={recordStartWrapper(started ? 'stop' : 'start')}
                disabled={buttonDisabled || loadProcent !== 0}
              >
                <div className={s.record}>
                  {started && loadProcent === 0 && <div className={s.time}>{time}</div>}
                  {started && loadProcent !== 0 && <div className={s.time}>{loadProcent}%</div>}
                  {started ? (
                    <StopIcon color={theme?.colors.red} />
                  ) : (
                    <RecIcon color={theme?.colors.red} />
                  )}
                </div>
              </IconButton>
            </div>
          </div>
          <div className={s.videos}>
            {videos.map((item) => (
              <div className={s.video} key={item.id}>
                <div className={s.actions}>
                  <IconButton onClick={playVideoWrapper({ id: item.id, name: item.name })}>
                    <PlayIcon width={20} height={20} color={theme?.colors.green} />
                  </IconButton>
                  <IconButton onClick={openUpdateDialogWrapper({ id: item.id, name: item.name })}>
                    <EditIcon width={20} height={20} color={theme?.colors.blue} />
                  </IconButton>
                  <IconButton onClick={openDeleteDialogWrapper({ id: item.id, name: item.name })}>
                    <DeleteIcon width={20} height={20} color={theme?.colors.red} />
                  </IconButton>
                </div>
                <div className={s.name}>{item.name}</div>
              </div>
            ))}
          </div>
          <div className={s.videos}>
            {tmps.map((item) => (
              <div className={s.video} key={item}>
                <div className={s.actions}>
                  <IconButton onClick={playTmpWrapper({ item })}>
                    <PlayIcon width={20} height={20} color={theme?.colors.green} />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      /** */
                    }}
                  >
                    <EditIcon width={20} height={20} color={theme?.colors.blue} />
                  </IconButton>
                  <IconButton
                    onClick={(e) => {
                      /** */
                    }}
                  >
                    <DeleteIcon width={20} height={20} color={theme?.colors.red} />
                  </IconButton>
                </div>
                <div className={s.name}>{item}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {playedVideo && <Video handleClose={handleCloseVideo} theme={theme} src={playedVideo} />}
      {playedTmp && (
        <Canvas
          server={server}
          port={port}
          handleClose={handleCloseTmp}
          token={token}
          theme={theme}
          src={playedTmp}
        />
      )}
      <Dialog {...dialogDelete} theme={theme}>
        <div className={s.dialog}>
          <h5 className={s.title}>{locale.needDeleteVideo}</h5>
          <p className={s.desc}>{dialogDelete.context.name}</p>
          <div className={s.actions}>
            <Button onClick={closeDeleteDialogHandler} theme={theme}>
              {locale.close}
            </Button>
            <Button onClick={deleteVideoWrapper(dialogDelete.context)} theme={theme}>
              {locale.delete}
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog {...dialogUpdate} theme={theme}>
        <div className={s.dialog}>
          <h5 className={s.title}>{locale.changeVideoName}</h5>
          <div className={s.input}>
            <Input
              id={INPUT_CHANGE_NAME_ID}
              value={videoName}
              theme={theme}
              onInput={onInputName}
            />
            <label
              htmlFor={INPUT_CHANGE_NAME_ID}
              className={s.label}
              style={nameLenght === VIDEO_NAME_MAX_LENGHT ? { color: theme?.colors.yellow } : {}}
            >
              {nameLenght}/{VIDEO_NAME_MAX_LENGHT}
            </label>
          </div>
          <div className={s.actions}>
            <Button onClick={closeUpdateDialogHandler} theme={theme}>
              {locale.close}
            </Button>
            <Button onClick={updateVideoWrapper(dialogUpdate.context)} theme={theme}>
              {locale.save}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default Settings;
