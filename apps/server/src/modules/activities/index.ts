import get from 'lodash/get';
import { activitiesDBService } from '../../common/db/activities';
import { ContributionsService } from '../contribs';

class ActivitiesManagerImpl implements ContributionsService {
  /**
   * List or find activities
   *
   * ## searchTerms
   * - name {string}  find by name with exactly this name (case insensitive)
   * - ref {string} find by url ref property with exactly this property (case insensitive)
   * If both search terms are provided search is executed by name
   *
   * ## options
   * - fields {string} Possible values:
   *    - short {string} - get short version of  activities
   *    - full {string} -  get full version of  activities
   *    - raw {string} (deprecated) -  get raw version from db
   *
   * @param [terms]
   * @params [terms.name] {string} name of the app
   * @params [terms.ref] {string} url ref property
   * @params options
   * @params options.fields {string} which fields to retrieve, defaults to 'full' version
   */
  find(terms?) {
    terms = terms || {};

    return activitiesDBService.db
      .find(terms)
      .then(result => (result || []).map(activityRow => prepareForOutput(activityRow)));
  }
}
export const ActivitiesManager = new ActivitiesManagerImpl();

function prepareForOutput(activity) {
  // this is a legacy
  return Object.assign(
    { id: activity.id || activity._id },
    {
      ref: activity.ref,
      homepage: get(activity, 'schema.homepage', ''),
      isLegacy: activity.isLegacy,
    },
    activity.schema
  );
}
