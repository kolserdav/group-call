/******************************************************************************************
 * Repository: https://github.com/kolserdav/werift-sfu-react.git
 * File name: Theme.ts
 * Author: Sergey Kolmiller
 * Email: <kolserdav@uyem.ru>
 * License: MIT
 * License text: See in LICENSE file
 * Copyright: kolserdav, All rights reserved (c)
 * Create Date: Wed Aug 02 2023 23:56:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
import { ThemeType } from './types';

export type Themes = {
  dark: Theme;
  light: Theme;
};

export interface Color {
  paper: string;
  text: string;
  active: string;
  white: string;
  red: string;
  yellow: string;
  blue: string;
  black: string;
  green: string;
  cyan: string;
}

export interface Colors {
  light: Color;
  dark: Color;
}

// Additionals
export interface Theme {
  button: React.CSSProperties;
  link: React.CSSProperties;
  colors: Colors[ThemeType];
}

const colors: Colors = {
  dark: {
    paper: '#212121',
    text: '#cfcfcf',
    active: '#36413e',
    white: '#fff',
    black: 'black',
    red: 'orange',
    yellow: 'lightgoldenrodyellow',
    blue: '#1a6aaf',
    green: '#02e721',
    cyan: 'cyan',
  },
  light: {
    red: 'red',
    yellow: 'orange',
    blue: '#2748ce',
    paper: '#fff',
    text: '#5d5e60',
    active: 'rgb(182 181 181)',
    white: '#fff',
    black: '#000',
    green: 'green',
    cyan: '#0ab1db',
  },
};

export const themes: Themes = {
  dark: {
    button: {
      backgroundColor: colors.light.active,
      color: colors.light.text,
    },
    link: {
      color: colors.light.paper,
    },
    colors: colors.dark,
  },
  light: {
    button: {
      backgroundColor: colors.dark.active,
      color: colors.dark.text,
    },
    link: {
      color: colors.dark.paper,
    },
    colors: colors.light,
  },
};
