const { default: APIError } = require('json-api/build/types/APIError');
const constants = require('../constants');
const { mkLogger } = require('../logger');
const logger = mkLogger('resource-descriptions:dns.zones');
module.exports = {
  urlTemplates: {
    "self": process.env.BASE_URI + "/dns.zones/{id}",
    "relationship": process.env.BASE_URI + "/dns.zones/{ownerId}/relationships/{path}"
  },
  /**
   * An optional function called on each resource provided by the client (i.e.
   * in a POST or PATCH request) before it's sent to the adapter for saving. You
   * can transform the data here as necessary or pre-emptively reject the
   * request. If you enable `transformLinkage` in your resource type
   * description, this will also receive ResourceIdentifier objects. See README
   * for details/caveats.
   *
   * @param {import('json-api').Resource} resource - The resource to be transformed
   * @param {Object} meta - Some information about the context in which the
   *   resource appeared.
   * @param {Object} extras - Various useful objects (e.g., the request object
   *   from your server's http library and the json-api lib; the resource type
   *   registry; etc.)
   * @param {Function} superFn - The beforeSave function on the parent
   *   resource type, if any
   * @returns {Resource|undefined|Promise<Resource|undefined>} - The transformed resource
   * @throws Can throw an error (APIError or Error) to abort the request
   */
  beforeSave: function (resource, meta, extras, superFn) {
    if (!resource.relationships.client.some(t => t.id === extras.serverReq.client.id)) {
      logger.debug("mismatched clients:", { reqClient: extras.serverReq.client, resource });
      throw new APIError({
        status: 401,
        title: "Unauthorized",
        detail: "The request is unauthorized, That's all we know. " + constants.THATS_ALL_WE_KNOW
      })
    }
    return resource;
  },
}
