module.exports = {
  parentType: "organizations",
  urlTemplates: {
    "self": "/schools/{id}",
    "relationship": "/schools/{ownerId}/relationships/{path}"
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
