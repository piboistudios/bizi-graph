const constants = require('./constants');
const { mkLogger } = require('./logger');

const logger = mkLogger('bizi-graph');
async function main() {


  'use strict';
  var path = require('path')
    , express = require('express')
    , API = require('json-api')
    , APIError = API.types.Error
    , mongoose = require('mongoose')
  /* virtualQueryFactory = async function queryFactory(opts) {

   // use the library's built-in logic, provided by the makeQuery function,
   // to generate a base query that will find all people
   const origQuery = await opts.makeQuery(opts);
   const origReturning = origQuery.returning;

   // Whether the user has asked to include the contents for our synthetic
   // principalOf relationship (which is backed by School.principal).
   const includingPrincipalOf =
     (opts.request.queryParams.include || []).includes('principalOf');

   // Remove the principalOf path from population, since passing that to the
   // adapter will cause an error, because Person model doesn't actually have
   // a principalOf relationship.
   const newQuery = includingPrincipalOf
     ? origQuery.withoutPopulates(['principalOf'])
     : origQuery;

   // Use `.resultsIn` to create a new query based on newQuery, but with a
   // different `.returning` function. (query.returning holds the function
   // responsible for formatting the db results from mongo.) In the new
   // returning function, query for the related schools and include them
   // when ?include=principalOf is in use.
   return newQuery.resultsIn(async (...args) => {
     const result = await origReturning(...args);
     const peopleById = result.document.primary.values.reduce((acc, it) => {
       acc[it.id] = it;
       return acc;
     }, {});

     const peopleIds = Object.keys(peopleById);
     if (includingPrincipalOf) {
       const schoolsQuery = new API.FindQuery({ type: "schools" }).andWhere({
         field: "principal",
         operator: "in",
         value: peopleIds
       });
       logger.debug("Schools query:", schoolsQuery);
       const schools =
         (await adapter.find(schoolsQuery)).primary.value.data;
       logger.debug("Schools:", schools);
       // Add schools to document.included
       result.document.included = (result.document.included || []).concat(schools);

       // Compute the list of schools that belong to each person.
       const peopleIdsToSchoolIds = schools.reduce((acc, school) => {
         const principalData = school.relationships.principal.values;
         const principalId = principalData[0] && principalData[0].id;
         if (principalId) {
           acc[principalId] = (acc[principalId] || []).concat(school.id);
         }
         return acc;
       }, {});

       // Augtment the principalOf relationship on each person with
       // the final school linkage.
       peopleIds.forEach((id) => {
         peopleById[id].relationships.principalOf = API.Relationship.of({
           data: (peopleIdsToSchoolIds[id] || []).map(id =>
             new API.ResourceIdentifier("organizations", id)
           ),
           links: peopleById[id].relationships.principalOf.links,
           owner: peopleById[id].relationships.principalOf.owner
         });
       });
     }

     return result;
   });
 }; */


  // Start by loading up all our mongoose models and connecting.
  var OrganizationModelSchema = require('./models/organization')
    , OrganizationModel = OrganizationModelSchema.model
    , OrganizationSchema = OrganizationModelSchema.schema;

  var models = {
    Person: require('./models/person'),
    Organization: OrganizationModel,
    School: require('./models/school')(OrganizationModel, OrganizationSchema),
    Client: require('./models/client'),
    "dns.Recordset": require('./models/dns.recordset'),
    "dns.Zone": require('./models/dns.zone')
  }
  const pluralize = require('pluralize');
  const dashify = require('dashify');
  // And registering them with the json-api library.
  // Below, we load up every resource type and give each the same adapter; in
  // theory, though, different types could be powered by different dbs/adapters.
  // Check /resource-desciptions/school.js to see some of the advanced features.
  var adapter = new API.dbAdapters.Mongoose(models, m => pluralize(m
    .replace(/[a-z]([A-Z])/g, "-$1")
    .toLowerCase()));
  var registry = new API.ResourceTypeRegistry({
    people: require('./resource-descriptions/people'),
    organizations: require('./resource-descriptions/organizations'),
    schools: require('./resource-descriptions/schools'),
    clients: require('./resource-descriptions/clients'),
    "dns.recordsets": require('./resource-descriptions/dns.recordsets'),
    "dns.zones": require('./resource-descriptions/dns.zones')
  }, { dbAdapter: adapter });

  var Controller = new API.controllers.API(registry);

  // Initialize the automatic documentation.
  var Docs = new API.controllers.Documentation(registry, { name: 'Example API' });

  // tell the lib the host name your API is served from; needed for security.
  var opts = { host: 'http://127.0.0.1:3000' };

  // Initialize the express app + front controller.
  var app = express();
  const morgan = require('morgan');
  const httpLogger = morgan('combined');
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({
    type: "application/vnd.api+json"
  }));

  app.use(async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      logger.error("Request missing API Key (request headers):", req.headers);
      return Front.sendError(new APIError({
        status: 401,
        title: "Unauthorized",
        detail: "The request is unauthorized, That's all we know. " + constants.THATS_ALL_WE_KNOW
      }), req, res, next);

    }
    const [key, secret] = apiKey.split('.');
    const client = await models.Client.findOne({
      key
    });
    if (!client) {
      logger.error("No client found (request headers):", req.headers);
      return Front.sendError(new APIError({
        status: 401,
        title: "Unauthorized",
        detail: "The request is unauthorized, That's all we know. " + constants.THATS_ALL_WE_KNOW
      }), req, res, next);
    }
    if (!await client.verifySecret(secret)) {
      logger.error("Invalid client secret (request headers):", req.headers);
      return Front.sendError(new APIError({
        status: 401,
        title: "Unauthorized",
        detail: "The request is unauthorized, That's all we know. " + constants.THATS_ALL_WE_KNOW
      }), req, res, next);
    }
    req.client = client;
    next();
  });
  var Front = new API.httpStrategies.Express(Controller, Docs, opts);
  var apiReqHandler = Front.apiRequest;

  // Enable CORS. Note: if you copy this code into production, you may want to
  // disable this. See https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
  app.use(function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    logger.debug("req.client?", req.client);
    next();
  })

  // Now, add the routes.
  // To demo some advanced functionality, we start with a route below that
  // constructs a customized query.

  // 1. This route demonstrates adding a where clause to the library-generated query.
  // query.andWhere returns a new query that'll be used in place of the original.
  app.get('/:type(schools)/colleges', Front.customAPIRequest({
    queryFactory: async (opts) => {
      const origQuery = await opts.makeQuery(opts);
      return origQuery.andWhere({ field: "isCollege", operator: "eq", value: true });
    }
  }));

  // 2. Likewise, at this route, we stick some extra computed data in meta if the
  // ?addNameList param is present. This shows how to get access to req in your
  // query transform fn and modify the response document. Note, you can
  // call `.resultsIn` with a second argument too to format query errors.
  // See https://github.com/ethanresnick/json-api/blob/c394e2c2cdeae63acf3c6660516891a2cf56affb/test/app/src/index.ts#L51
  app.get('/:type(people)',
    Front.customAPIRequest({
      queryTransform: (req, query) => {
        if (!('addNameList' in req.query)) {
          return query;
        }

        const origReturning = query.returning;
        return query.resultsIn(async (...args) => {
          const origResult = await origReturning(...args);
          const names = origResult.document.primary.map(it => it.attrs.name).values;
          origResult.document.meta = { ...origResult.document.meta, names };
          return origResult;
        })
      }
    })
  );

  // Add generic/untransformed routes.
  // These routes don't need any special treatment, and cover most of our endpoints.
  // To do this in a more scalable and configurable way, check out
  // http://github.com/ethanresnick/express-simple-router. To protect some
  // routes, check out http://github.com/ethanresnick/express-simple-firewall.
  app.get("/", Front.docsRequest);
  app.route("/:type(people|organizations|schools)")
    .get(apiReqHandler).post(apiReqHandler).patch(apiReqHandler);
  app.route("/:type(people|organizations|schools)/:id")
    .get(apiReqHandler).patch(apiReqHandler).delete(apiReqHandler);
  app.route("/:type(people|organizations|schools)/:id/relationships/:relationship")
    .get(apiReqHandler).post(apiReqHandler).patch(apiReqHandler).delete(apiReqHandler);
  app.route("/:type(clients|dns.recordsets|dns.zones)")
    .get(apiReqHandler).post(apiReqHandler).patch(apiReqHandler);
  app.route("/:type(clients|dns.recordsets|dns.zones)/:id")
    .get(apiReqHandler).patch(apiReqHandler).delete(apiReqHandler);
  app.route("/:type(clients|dns.recordsets|dns.zones)/:id/relationships/:relationship")
    .get(apiReqHandler).post(apiReqHandler).patch(apiReqHandler).delete(apiReqHandler);


  // This last route below shows how to augment the auto-generated query for the
  // GET /virtual-demo/people endpoint to support an ?include=principalOf parameter
  // that populates a "virtual" principalOf relationship. (It reads the contents
  // from School.principal; the relationship doesn't actually exist on Person model.)
  //
  // Note: you can use the exact same query factory for /people/:id route.
  // Note 2: Users won't be able to add to this virtual relationship with a PATCH
  // on the person or a POST to /people/:id/relationships/principalOf, because
  // the relationship is virtual. However, you could write query factories to
  // support those cases too. This will all be handled automatically, though,
  // once the built-in Mongoose adapter supports "virtual populate" fields.
  // app.get('/virtual-demo/:type(people)', Front.customAPIRequest({
  // queryFactory: virtualQueryFactory
  // }));
  // 
  app.use(function (req, res, next) {
    Front.sendError(new APIError(404, undefined, 'Not Found'), req, res);
  });

  // And we're done! Start 'er up!
  console.log('Starting up! Visit 127.0.0.1:3000 to see the docs.');
  const port = process.env.PORT || 8081;
  const server = app.listen(port);
  server.on('listening', () => {
    logger.info("😎 Listening on port", port);
  });

}
module.exports = main;