const yup = require('yup');

let eventSchema = yup.object().shape({
  catcherType: yup.string().required(),
  payload: yup
    .object()
    .shape({
      title: yup.string().required(),
      timestamp: yup.date().required(),
      level: yup.number().integer(),
      // .required(), // enable when fix senders
      backtrace: yup.array().of(
        yup.object().shape({
          file: yup.string().required(),
          line: yup
            .number()
            .integer()
            .required(),
          sourceCode: yup.array().of(
            yup.object().shape({
              line: yup
                .number()
                .integer()
                .required(),
              content: yup
                .string()
                .required()
                .required()
            })
          )
        })
      ),
      get: yup.mixed(),
      post: yup.mixed(),
      headers: yup.mixed(),
      release: yup.string(),
      user: yup.object().shape({
        id: yup.string(),
        name: yup.string(),
        url: yup.string(),
        photo: yup.string()
      }),
      context: yup.mixed()
    })
    .required()
});

module.exports = {
  eventSchema
};
