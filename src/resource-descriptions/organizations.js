module.exports = {
  urlTemplates: {
    "self": process.env.BASE_URI + "/organizations/{id}",
    "relationship": process.env.BASE_URI + "/organizations/{ownerId}/relationships/{path}"
  }
}
