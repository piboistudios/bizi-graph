module.exports = {
  urlTemplates: {
    "self": process.env.BASE_URI + "/dns.recordsets/{id}",
    "relationship": process.env.BASE_URI + "/dns.recordsets/{ownerId}/relationships/{path}"
  }
}
