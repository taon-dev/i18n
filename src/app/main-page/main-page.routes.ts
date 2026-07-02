//#region imports
import { Routes } from '@angular/router';

import { MainPageContainer } from './main-page.container';
//#endregion

export const MainPageRoutes: Routes = [
  {
    path: '',
    component: MainPageContainer,
  },
  // {
  //   path: 'anothermodulepath',
  //   loadChildren: () => import('anothermodule')
  //     .then(m => m.AnotherLazyModule),
  // },
];

/**
 * By default exporting MainPageRoutes,
 * the command `taon generate:app:routes`
 * will automatically add them to the root routes in ./src/app.ts.
 */
export default MainPageRoutes;