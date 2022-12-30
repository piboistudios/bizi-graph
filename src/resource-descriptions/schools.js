module.exports = {
  parentType: "organizations",
  urlTemplates: {
    "self": process.env.BASE_URI + "/schools/{id}",
    "relationship": process.env.BASE_URI + "/schools/{ownerId}/relationships/{path}"
  },

  info: {
    "description": "A description of your School resource (optional).",
    "fields": {
      "isCollege": {
        "description": "Whether the school is a college, by the U.S. meaning."
      }
    }
  }
}
