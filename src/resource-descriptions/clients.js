module.exports = {
  urlTemplates: {
    "self": process.env.BASE_URI + "/clients/{id}",
    "relationship": process.env.BASE_URI + "/clients/{ownerId}/relationships/{path}"
  }
}
