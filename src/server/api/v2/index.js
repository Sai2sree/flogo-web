import { config } from '../../config/app-config';
import { apps } from './apps';
import { triggers } from './triggers';
import { actions } from './actions';
import { contribs } from './contribs';
import { handlers } from './handlers';
import { profiles } from './profiles';

export function registerRoutes(router) {
  const basePathV2 = config.app.basePathV2;
  apps(router, basePathV2);
  triggers(router, basePathV2);
  actions(router, basePathV2);
  contribs(router, basePathV2);
  handlers(router, basePathV2);
  profiles(router, basePathV2);
}