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

test('S3 Bucket created', () => {
  template.resourceCountIs('AWS::S3::Bucket', 1);
});

test('S3 Bucket Versioning Enabled', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    VersioningConfiguration: {
      Status: "Enabled"
    }
  });
});

test('S3 Bucket SSE Encryption Enabled', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        }
      ]
    }
  });
});
