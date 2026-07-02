//#region imports
//
import { TaonBaseContext, createContext } from 'taon/src';

import { HOST_CONFIG } from '../../app.hosts';
// import { MIGRATIONS_CLASSES_FOR_MainPageActiveContext } from '@taon-dev/i18n/src';
//#endregion

export const MainPageActiveContext = createContext(() => ({
  ...HOST_CONFIG['MainPageActiveContext'],
  contextName: 'MainPageActiveContext',
  database: true,
  // migrations: { ...MIGRATIONS_CLASSES_FOR_MainPageActiveContext },
  contexts: { TaonBaseContext },
  entities: {},
  controllers: {},
  repositories: {},
  middlewares: {},
  providers: {},
}));
