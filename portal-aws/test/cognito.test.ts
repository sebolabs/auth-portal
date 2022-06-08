import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as Portal from '../lib/portal-stack';

// CDK_DEFAULT_ACCOUNT=? CDK_DEFAULT_REGION=? npm test

const app = new cdk.App();
  const stack = new Portal.PortalStack(app, 'PortalStack', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
  }});
  const template = Template.fromStack(stack);

test('Cognito User Pool created', () => {
  template.resourceCountIs('AWS::Cognito::UserPool', 1);
});

test('Cognito User Pool allow admin create user only', () => {
  template.hasResourceProperties('AWS::Cognito::UserPool', {
    AdminCreateUserConfig: {
      AllowAdminCreateUserOnly: true
    }
  });
});
