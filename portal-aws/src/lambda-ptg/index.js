exports.handler = (event, context, callback) => {

  // Note: here come customisations...
  // More info: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html

  // Log to CloudWatch logs
  console.log(event)

  // Return to Amazon Cognito
  callback(null, event);
};
