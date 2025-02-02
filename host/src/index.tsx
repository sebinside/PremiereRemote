/**
 * ALL functions defined here are visible via the localhost service.
 */
export const host = {
  /**
   * @swagger
   *
   * /kill:
   *      get:
   *          description: This method is only there for debugging purposes.
   *                       For more information, please have a look at the index.js file.
   */
  kill: function () { },

  /**
   * @swagger
   * /yourNewFunction?param1={param1}&param2={param2}:
   *      get:
   *          description: Your new function, ready to be called!
   *          parameters:
   *              - name: param1
   *                description: Just a sample parameter
   *                in: path
   *                type: string
   *              - name: param2
   *                description: Just another sample parameter
   *                in: path
   *                type: string
   */
  yourNewFunction: function (param1, param2) {
    alert(param1 + " " + param2);
  }
};

/**
 * These functions are only used internally.
 */
export const framework = {
  enableQualityEngineering: function () {
    app.enableQE();
  }
};
