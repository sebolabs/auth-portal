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

test('CloudFront Distribution created', () => {
  template.resourceCountIs('AWS::CloudFront::Distribution', 1);
});

test('CloudFront Distribution default root object is index.html', () => {
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultRootObject: "index.html"
    }
  });
});

test('CloudFront OAI created', () => {
  template.resourceCountIs('AWS::CloudFront::CloudFrontOriginAccessIdentity', 1);
});
