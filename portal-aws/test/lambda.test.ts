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

// test('Lambda Function created', () => {
//   template.resourceCountIs('AWS::Lambda::Function', 1);
// });

test('Lambda Function runs on ARM64 architecture', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    Architectures: ["arm64"]
  });
});
